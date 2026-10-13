const express = require('express');
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Rate-limits to 20 requests per minute per IP
const assistantLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  handler: (_req, res) => {
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded: maximum 20 requests per minute.',
      message: 'Rate limit exceeded: maximum 20 requests per minute.',
    });
  },
});

router.use(protect);
router.use(assistantLimiter);

const SYSTEM_PROMPT =
  'You are the built-in assistant for JILE Electronics, an electronics shop management system (POS, inventory, sales, customers, profit reports). Be short and practical. Answer in Somali if the user writes in Somali. Never invent stock, prices, or sales figures. You cannot change data; tell the user which page and button to use.';

const handleAssistant = async (req, res) => {
  const { messages } = req.body || {};

  // 400 for bad input
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Bad input: "messages" must be a non-empty array of message objects.',
      message: 'Bad input: "messages" must be a non-empty array of message objects.',
    });
  }

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (
      !msg ||
      typeof msg !== 'object' ||
      !msg.role ||
      !['user', 'assistant'].includes(msg.role) ||
      msg.content === undefined ||
      msg.content === null ||
      typeof msg.content !== 'string'
    ) {
      return res.status(400).json({
        success: false,
        error: `Bad input: message at index ${i} must have role ("user" or "assistant") and string content.`,
        message: `Bad input: message at index ${i} must have role ("user" or "assistant") and string content.`,
      });
    }
  }

  // 503 if the key is missing
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return res.status(503).json({
      success: false,
      error: 'ANTHROPIC_API_KEY is missing.',
      message: 'ANTHROPIC_API_KEY is missing.',
    });
  }

  // Keeps the last 12 messages and caps each message at 2000 characters
  let trimmed = messages.slice(-12).map((m) => ({
    role: m.role,
    content: m.content.slice(0, 2000),
  }));

  // Anthropic API requires messages to start with role 'user'
  while (trimmed.length > 0 && trimmed[0].role !== 'user') {
    trimmed.shift();
  }

  if (trimmed.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Bad input: at least one user message is required.',
      message: 'Bad input: at least one user message is required.',
    });
  }

  const model = process.env.ASSISTANT_MODEL || 'claude-sonnet-5-5';

  try {
    const upstreamRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey.trim(),
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 800,
        system: SYSTEM_PROMPT,
        messages: trimmed,
      }),
    });

    if (!upstreamRes.ok) {
      const errBody = await upstreamRes.text().catch(() => '');
      console.error('Anthropic API upstream error:', upstreamRes.status, errBody);
      let upstreamMsg = upstreamRes.statusText || `HTTP ${upstreamRes.status}`;
      try {
        const parsed = JSON.parse(errBody);
        if (parsed?.error?.message) {
          upstreamMsg = parsed.error.message;
        }
      } catch (e) {}
      return res.status(502).json({
        success: false,
        error: `Upstream AI API error: ${upstreamMsg}`,
        message: `Upstream AI API error: ${upstreamMsg}`,
      });
    }

    const data = await upstreamRes.json();
    let reply = '';
    if (Array.isArray(data.content)) {
      reply = data.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n');
    } else if (typeof data.reply === 'string') {
      reply = data.reply;
    }

    return res.json({ reply });
  } catch (err) {
    console.error('Anthropic API fetch failed:', err);
    return res.status(502).json({
      success: false,
      error: 'Failed to communicate with upstream AI API.',
      message: err.message || 'Failed to communicate with upstream AI API.',
    });
  }
};

router.post('/', handleAssistant);

module.exports = router;
