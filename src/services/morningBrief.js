/**
 * Morning Brief — generates and sends a daily AI brief to each user
 *
 * Adapted from TerritoryPulse's generateDailyBrief + sendMorningBriefs.
 * Uses TerritoryPilot's existing supabase, openai, and haversine modules.
 */
const supabase = require('./supabase');
const openai = require('./openai');
const { Resend } = require('resend');
const { config } = require('../config');
const { nearestNeighborTSP, haversine } = require('../utils/haversine');
const { morningBriefHtml, morningBriefText } = require('./emailTemplates');

const resend = config.resend.apiKey ? new Resend(config.resend.apiKey) : null;

// Optional Twilio — only initialised if credentials are present
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  try {
    const Twilio = require('twilio');
    twilioClient = Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  } catch (_) { /* twilio not installed — skip SMS */ }
}

// ─── Talk-track generator ────────────────────────────────────────────────────

async function generateAccountTalkTrack(account) {
  if (!openai) return 'AI brief unavailable — missing OpenAI key.';

  const daysSinceVisit = account.last_visited
    ? Math.floor((Date.now() - new Date(account.last_visited)) / 86400000)
    : null;

  const priorityLabel = { 1: 'HIGH', 3: 'LOW' }[account.priority] || 'MEDIUM';

  const prompt = `You are a sales coach helping a field rep prepare for a visit.

Account: ${account.name}
Contact: ${account.contact_name || 'Unknown'} (${account.contact_title || 'N/A'})
Industry: ${account.industry || 'N/A'}
Last visit: ${daysSinceVisit !== null ? `${daysSinceVisit} days ago` : 'Never visited'}
Last visit notes: ${account.notes || 'None'}
Open opportunity value: $${(account.open_opportunity_value || 0).toLocaleString()}
Priority: ${priorityLabel}

Write a 3-sentence talk track for this visit. Be specific, confident, and action-oriented. Include:
1. A re-engagement opener referencing the last visit or a relevant hook
2. The main value point to drive today
3. A clear ask / next step

Keep it punchy — under 60 words total.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 150,
  });

  return response.choices[0].message.content.trim();
}

// ─── Determine "Account of the Day" ─────────────────────────────────────────

function pickAccountOfDay(route) {
  // Highest-priority account with an open opportunity, or first stop
  return route.find(a => a.priority === 1 && (a.open_opportunity_value || 0) > 0) || route[0];
}

// ─── Calculate total route miles ─────────────────────────────────────────────

function calculateTotalMiles(route) {
  if (!route.length) return 0;
  let total = 5; // baseline home-to-first-stop estimate
  for (let i = 0; i < route.length - 1; i++) {
    total += haversine(route[i].lat, route[i].lng, route[i + 1].lat, route[i + 1].lng);
  }
  return total;
}

// ─── Generate brief for one user ─────────────────────────────────────────────

async function generateDailyBrief(user, accounts) {
  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // Filter to accounts overdue for a visit (high priority always included)
  const accountsToVisit = accounts.filter(a => {
    if (!a.lat || !a.lng) return false;
    if (a.priority === 1) return true; // high priority always
    const daysSince = a.last_visited
      ? Math.floor((Date.now() - new Date(a.last_visited)) / 86400000)
      : 999;
    return daysSince >= 7;
  }).slice(0, 12); // cap at 12 stops

  if (!accountsToVisit.length) return null;

  // Default start (can be enhanced later with user home_address)
  const startLat = 44.98;
  const startLng = -93.27;

  const { route } = nearestNeighborTSP(accountsToVisit, startLat, startLng);
  const totalMiles = calculateTotalMiles(route);

  // Generate talk tracks for top 5 stops
  const topAccounts = route.slice(0, 5);
  const talkTracks = await Promise.all(topAccounts.map(a => generateAccountTalkTrack(a)));

  const accountOfDay = pickAccountOfDay(route);
  const repName = user.name || user.email.split('@')[0];

  const briefHtmlContent = morningBriefHtml({ repName, date, route, totalMiles, talkTracks, accountOfDay });
  const briefTextContent = morningBriefText({ repName, date, route, totalMiles, accountOfDay });

  return { briefHtml: briefHtmlContent, briefText: briefTextContent, totalMiles, route };
}

// ─── Send brief via email (+ optional SMS) ───────────────────────────────────

async function sendBrief(user, briefHtml, briefText) {
  const jobs = [];

  if (resend) {
    jobs.push(
      resend.emails.send({
        from: 'TerritoryPilot <brief@territorypilot.com>',
        to: user.email,
        subject: `Your Territory Brief — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`,
        html: briefHtml,
        text: briefText,
      })
    );
  }

  if (twilioClient && user.phone) {
    jobs.push(
      twilioClient.messages.create({
        body: briefText.slice(0, 1600),
        from: process.env.TWILIO_PHONE_NUMBER,
        to: user.phone,
      })
    );
  }

  await Promise.allSettled(jobs);
}

// ─── Main runner: iterate all users and send briefs ──────────────────────────

async function sendMorningBriefs() {
  if (!supabase) {
    console.error('[MorningBrief] Supabase not configured — skipping.');
    return;
  }

  console.log(`[${new Date().toISOString()}] Running morning brief generation...`);

  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, name');

  if (error) {
    console.error('[MorningBrief] Failed to fetch users:', error.message);
    return;
  }

  for (const user of users) {
    try {
      const { data: accounts } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id)
        .not('lat', 'is', null)
        .not('lng', 'is', null);

      if (!accounts?.length) continue;

      const brief = await generateDailyBrief(user, accounts);
      if (!brief) continue;

      const briefDate = new Date().toISOString().split('T')[0];

      // Store brief in daily_briefs table
      await supabase.from('daily_briefs').upsert({
        user_id: user.id,
        brief_date: briefDate,
        route_order: brief.route.map(a => a.id),
        total_miles: brief.totalMiles,
        brief_html: brief.briefHtml,
        sent_at: new Date().toISOString(),
      }, { onConflict: 'user_id,brief_date' });

      // Send email/SMS
      await sendBrief(user, brief.briefHtml, brief.briefText);
      console.log(`  ✓ Sent brief to ${user.name || user.email}`);
    } catch (err) {
      console.error(`  ✗ Failed for user ${user.id}:`, err.message);
    }
  }

  console.log(`[${new Date().toISOString()}] Morning briefs complete.`);
}

module.exports = { sendMorningBriefs, generateDailyBrief };
