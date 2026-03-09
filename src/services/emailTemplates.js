/**
 * HTML email template for the daily morning brief
 */

function morningBriefHtml({ repName, date, route, totalMiles, talkTracks, accountOfDay }) {
  const topAccounts = route.slice(0, 5);
  const pipelineTotal = route.reduce((s, a) => s + (a.open_opportunity_value || 0), 0);

  // Priority int (1/2/3) → CSS class name
  const priorityClass = (p) => ({ 1: 'high', 3: 'low' }[p] || 'medium');
  const priorityLabel = (p) => ({ 1: 'HIGH', 3: 'LOW' }[p] || 'MEDIUM');

  const stopsHtml = topAccounts.map((account, i) => `
<div class="route-stop priority-${priorityClass(account.priority)}">
  <div class="stop-num">Stop ${i + 1}</div>
  <div class="stop-name">${esc(account.name)}</div>
  <div class="stop-meta">${esc(account.address || '')} &middot; ${esc(account.contact_name || 'No contact')} &middot; ${account.last_visited ? `Last visit: ${new Date(account.last_visited).toLocaleDateString()}` : 'First visit!'}</div>
  <div class="talk-track">${esc(talkTracks[i] || 'Prepare a value-focused opener.')}</div>
</div>
`).join('');

  const extraStopsHtml = route.length > 5
    ? `<div style="background: #f5f5f5; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
  <strong>+${route.length - 5} more stops:</strong> ${route.slice(5).map(a => esc(a.name)).join(' &rarr; ')}
</div>`
    : '';

  const aodHtml = accountOfDay
    ? `<div class="aod">
  <h3>&#11088; Account of the Day</h3>
  <div class="name">${esc(accountOfDay.name)}</div>
  <div style="color: #856404; font-size: 14px;">${esc(accountOfDay.contact_name || 'No contact')} &middot; $${(accountOfDay.open_opportunity_value || 0).toLocaleString()} opportunity &middot; ${priorityLabel(accountOfDay.priority)} priority</div>
</div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a2e; }
  .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 24px; border-radius: 12px; margin-bottom: 24px; }
  .header h1 { margin: 0; font-size: 24px; }
  .header p { margin: 4px 0 0; opacity: 0.85; font-size: 14px; }
  .stat-row { display: flex; gap: 16px; margin-bottom: 24px; }
  .stat { background: #f8f9ff; border: 1px solid #e8e9ff; border-radius: 8px; padding: 16px; flex: 1; text-align: center; }
  .stat .num { font-size: 28px; font-weight: 700; color: #667eea; }
  .stat .label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
  .aod { background: #fff3cd; border: 1px solid #ffc107; border-radius: 10px; padding: 20px; margin-bottom: 24px; }
  .aod h3 { margin: 0 0 8px; color: #856404; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; }
  .aod .name { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
  .route-stop { border-left: 3px solid #667eea; padding: 16px 16px 16px 20px; margin-bottom: 16px; background: #fafbff; border-radius: 0 8px 8px 0; }
  .stop-num { font-size: 12px; color: #667eea; font-weight: 700; text-transform: uppercase; }
  .stop-name { font-size: 16px; font-weight: 600; margin: 2px 0; }
  .stop-meta { font-size: 13px; color: #666; margin-bottom: 8px; }
  .talk-track { background: white; border: 1px solid #e0e0e0; border-radius: 6px; padding: 12px; font-size: 14px; line-height: 1.5; font-style: italic; }
  .priority-high { border-left-color: #e74c3c; }
  .priority-low { border-left-color: #95a5a6; }
  .footer { text-align: center; color: #aaa; font-size: 12px; margin-top: 32px; }
</style>
</head>
<body>

<div class="header">
  <h1>Good morning, ${esc(repName)}!</h1>
  <p>${esc(date)} &middot; TerritoryPilot Daily Brief</p>
</div>

<div class="stat-row">
  <div class="stat">
    <div class="num">${route.length}</div>
    <div class="label">Stops Today</div>
  </div>
  <div class="stat">
    <div class="num">${Math.round(totalMiles)}</div>
    <div class="label">Est. Miles</div>
  </div>
  <div class="stat">
    <div class="num">$${pipelineTotal.toLocaleString()}</div>
    <div class="label">Pipeline at Stake</div>
  </div>
</div>

${aodHtml}

<h2 style="font-size: 16px; color: #333; border-bottom: 2px solid #eee; padding-bottom: 8px;">Your Route Today</h2>

${stopsHtml}
${extraStopsHtml}

<div class="footer">
  Powered by <strong>TerritoryPilot</strong>
</div>

</body>
</html>`;
}

function morningBriefText({ repName, date, route, totalMiles, accountOfDay }) {
  const pipelineTotal = route.reduce((s, a) => s + (a.open_opportunity_value || 0), 0);
  return `TERRITORYPILOT — ${date}

Good morning ${repName}! Here's your day:

${route.length} stops · ~${Math.round(totalMiles)} miles · $${pipelineTotal.toLocaleString()} pipeline

ACCOUNT OF THE DAY: ${accountOfDay?.name || 'N/A'}

YOUR ROUTE:
${route.slice(0, 5).map((a, i) => `${i + 1}. ${a.name} — ${a.address || 'No address'}`).join('\n')}
${route.length > 5 ? `...+${route.length - 5} more` : ''}

Go get 'em.`;
}

/** Escape HTML entities */
function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = { morningBriefHtml, morningBriefText };
