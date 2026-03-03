/**
 * AI walk-in brief generation with caching
 */
const { Router } = require('express');
const supabase = require('../services/supabase');
const openai = require('../services/openai');
const auth = require('../middleware/auth');
const { validate, generateBriefSchema } = require('../middleware/validate');
const { asyncHandler } = require('../middleware/errorHandler');

const router = Router();

// POST /api/brief/generate
router.post(
  '/generate',
  auth,
  validate(generateBriefSchema),
  asyncHandler(async (req, res) => {
    const { accountId } = req.body;

    if (!openai) return res.status(500).json({ error: 'AI service unavailable' });

    // Check for cached brief (<24hrs)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: cached } = await supabase
      .from('briefs')
      .select('brief, account_id')
      .eq('account_id', accountId)
      .eq('user_id', req.user.id)
      .gte('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (cached) {
      return res.json({ brief: cached.brief, account: cached.account_id, cached: true });
    }

    // Fetch account — with ownership check (fixes issue #2.8)
    const { data: account } = await supabase
      .from('accounts')
      .select('id, name, contact_name, notes, last_visited')
      .eq('id', accountId)
      .eq('user_id', req.user.id)
      .single();

    if (!account) return res.status(404).json({ error: 'Account not found' });

    // Fetch recent call logs
    const { data: logs } = await supabase
      .from('call_logs')
      .select('summary, created_at')
      .eq('account_id', accountId)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(3);

    const logsContext = logs?.length
      ? logs.map((l) => `[${new Date(l.created_at).toLocaleDateString()}] ${l.summary}`).join('\n')
      : 'No previous call logs.';

    const prompt = `You are a sales coach. Given this account and call history, write a 2-3 sentence walk-in brief for a field sales rep. Be specific: what to lead with, what the contact cares about, any urgency.

Account: ${account.name}
Primary Contact: ${account.contact_name || 'Unknown'}
Account Notes: ${account.notes || 'None'}
Last Visited: ${account.last_visited || 'Never'}
Recent Call History:
${logsContext}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 180,
      temperature: 0.7,
    });

    const brief = completion.choices[0].message.content.trim();

    // Cache the brief
    await supabase.from('briefs').insert({
      account_id: accountId,
      user_id: req.user.id,
      brief,
      created_at: new Date().toISOString(),
    });

    res.json({ brief, account: account.name });
  })
);

// POST /api/brief/batch — batch generate briefs for multiple accounts
router.post(
  '/batch',
  auth,
  asyncHandler(async (req, res) => {
    const { accountIds } = req.body;
    if (!Array.isArray(accountIds) || !accountIds.length) {
      return res.status(400).json({ error: 'accountIds array required' });
    }

    const results = [];
    // Process sequentially to avoid overwhelming OpenAI
    for (const accountId of accountIds.slice(0, 20)) {
      try {
        // Re-use the single generate logic by making an internal-style call
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: cached } = await supabase
          .from('briefs')
          .select('brief')
          .eq('account_id', accountId)
          .eq('user_id', req.user.id)
          .gte('created_at', twentyFourHoursAgo)
          .limit(1)
          .single();

        if (cached) {
          results.push({ accountId, brief: cached.brief, cached: true });
          continue;
        }

        const { data: account } = await supabase
          .from('accounts')
          .select('id, name, contact_name, notes, last_visited')
          .eq('id', accountId)
          .eq('user_id', req.user.id)
          .single();

        if (!account || !openai) {
          results.push({ accountId, error: 'Not found or AI unavailable' });
          continue;
        }

        const { data: logs } = await supabase
          .from('call_logs')
          .select('summary, created_at')
          .eq('account_id', accountId)
          .eq('user_id', req.user.id)
          .order('created_at', { ascending: false })
          .limit(3);

        const logsContext = logs?.length
          ? logs.map((l) => `[${new Date(l.created_at).toLocaleDateString()}] ${l.summary}`).join('\n')
          : 'No previous call logs.';

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{
            role: 'user',
            content: `You are a sales coach. Write a 2-3 sentence walk-in brief for a field sales rep.\n\nAccount: ${account.name}\nContact: ${account.contact_name || 'Unknown'}\nNotes: ${account.notes || 'None'}\nLast Visited: ${account.last_visited || 'Never'}\nRecent Calls:\n${logsContext}`,
          }],
          max_tokens: 180,
          temperature: 0.7,
        });

        const brief = completion.choices[0].message.content.trim();
        await supabase.from('briefs').insert({
          account_id: accountId,
          user_id: req.user.id,
          brief,
          created_at: new Date().toISOString(),
        });

        results.push({ accountId, brief, cached: false });
      } catch {
        results.push({ accountId, error: 'Failed to generate brief' });
      }
    }

    res.json({ results, generated: results.filter((r) => !r.error).length });
  })
);

module.exports = router;
