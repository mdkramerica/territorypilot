/**
 * Voice logging — audio upload, transcription, summarization
 */
const { Router } = require('express');
const multer = require('multer');
const supabase = require('../services/supabase');
const openai = require('../services/openai');
const auth = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max (Whisper limit)
});

// POST /api/log/voice
router.post(
  '/',
  auth,
  upload.single('audio'),
  asyncHandler(async (req, res) => {
    const { accountId } = req.body;
    if (!accountId) return res.status(400).json({ error: 'accountId required' });
    if (!req.file) return res.status(400).json({ error: 'Audio file required' });
    if (!openai) return res.status(500).json({ error: 'AI service unavailable' });

    // Verify account ownership (fixes issue #2.9)
    const { data: account } = await supabase
      .from('accounts')
      .select('id')
      .eq('id', accountId)
      .eq('user_id', req.user.id)
      .single();

    if (!account) return res.status(404).json({ error: 'Account not found' });

    // Transcribe with Whisper
    const file = new File(
      [req.file.buffer],
      req.file.originalname || 'audio.webm',
      { type: req.file.mimetype || 'audio/webm' }
    );

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      response_format: 'text',
    });

    // Summarize + extract outcome
    const summaryCompletion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: `Summarize this field sales call note in 1-2 sentences. Also extract the outcome as one of: positive, neutral, needs_followup, closed.

Return as JSON: {"summary": "...", "outcome": "..."}

Note: "${transcription}"`,
        },
      ],
      max_tokens: 150,
      response_format: { type: 'json_object' },
    });

    let summary = '';
    let outcome = '';
    try {
      const parsed = JSON.parse(summaryCompletion.choices[0].message.content);
      summary = parsed.summary || '';
      outcome = ['positive', 'neutral', 'needs_followup', 'closed'].includes(parsed.outcome)
        ? parsed.outcome
        : 'neutral';
    } catch {
      summary = summaryCompletion.choices[0].message.content.trim();
      outcome = 'neutral';
    }

    // Insert call log
    await supabase.from('call_logs').insert({
      account_id: accountId,
      user_id: req.user.id,
      transcript: transcription,
      summary,
      outcome,
      created_at: new Date().toISOString(),
    });

    // Update last_visited
    const today = new Date().toISOString().split('T')[0];
    await supabase
      .from('accounts')
      .update({ last_visited: today, updated_at: new Date().toISOString() })
      .eq('id', accountId)
      .eq('user_id', req.user.id);

    res.json({ transcript: transcription, summary, outcome });
  })
);

module.exports = router;
