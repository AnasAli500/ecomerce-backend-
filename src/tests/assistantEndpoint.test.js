const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

describe('Assistant Route /api/assistant', () => {
  const originalEnvKey = process.env.ANTHROPIC_API_KEY;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key-12345';
  });

  afterEach(() => {
    process.env.ANTHROPIC_API_KEY = originalEnvKey;
    global.fetch = originalFetch;
  });

  function createTestApp() {
    // Clear require cache for assistant to get fresh instance
    delete require.cache[require.resolve('../routes/assistant')];
    delete require.cache[require.resolve('../middleware/auth')];

    // Mock protect middleware for unit testing endpoint logic
    require.cache[require.resolve('../middleware/auth')] = {
      exports: {
        protect: (req, _res, next) => {
          if (req.headers.authorization === 'Bearer valid-test-token') {
            req.user = { _id: '123', name: 'Test User', role: 'admin' };
            return next();
          }
          return _res.status(401).json({ success: false, message: 'Not authorized' });
        },
      },
    };

    const assistantRoute = require('../routes/assistant');
    const app = express();
    app.use(express.json());
    app.use('/api/assistant', assistantRoute);
    return app;
  }

  async function makeRequest(app, body, auth = 'Bearer valid-test-token') {
    return new Promise((resolve) => {
      const server = app.listen(0, async () => {
        const port = server.address().port;
        try {
          const res = await fetch(`http://127.0.0.1:${port}/api/assistant`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(auth ? { Authorization: auth } : {}),
            },
            body: body !== undefined ? JSON.stringify(body) : undefined,
          });
          const json = await res.json().catch(() => null);
          resolve({ status: res.status, body: json });
        } finally {
          server.close();
        }
      });
    });
  }

  it('rejects unauthenticated requests with 401', async () => {
    const app = createTestApp();
    const res = await makeRequest(app, { messages: [{ role: 'user', content: 'hello' }] }, null);
    assert.equal(res.status, 401);
  });

  it('rejects missing or empty messages with 400', async () => {
    const app = createTestApp();
    const resEmpty = await makeRequest(app, { messages: [] });
    assert.equal(resEmpty.status, 400);

    const resMissing = await makeRequest(app, {});
    assert.equal(resMissing.status, 400);
  });

  it('rejects invalid message structure with 400', async () => {
    const app = createTestApp();
    const res = await makeRequest(app, {
      messages: [{ role: 'unknown_role', content: 'hello' }],
    });
    assert.equal(res.status, 400);
  });

  it('returns 503 if ANTHROPIC_API_KEY is missing', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const app = createTestApp();
    const res = await makeRequest(app, {
      messages: [{ role: 'user', content: 'hello' }],
    });
    assert.equal(res.status, 503);
    assert.match(res.body.error, /ANTHROPIC_API_KEY is missing/i);
  });

  it('returns 502 if upstream API responds with an error status', async () => {
    global.fetch = async (url, options) => {
      if (typeof url === 'string' && url.includes('anthropic.com')) {
        return {
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          text: async () =>
            JSON.stringify({
              error: { message: 'Credit balance is too low' },
            }),
        };
      }
      return originalFetch(url, options);
    };

    const app = createTestApp();
    const res = await makeRequest(app, {
      messages: [{ role: 'user', content: 'What is POS?' }],
    });
    assert.equal(res.status, 502);
    assert.match(res.body.error, /Credit balance is too low/i);
  });

  it('returns { reply } when upstream API succeeds', async () => {
    let capturedBody = null;
    global.fetch = async (url, options) => {
      if (typeof url === 'string' && url.includes('anthropic.com')) {
        capturedBody = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            content: [
              {
                type: 'text',
                text: 'To create a sale, go to the POS page and click Complete Sale.',
              },
            ],
          }),
        };
      }
      return originalFetch(url, options);
    };

    const app = createTestApp();
    const res = await makeRequest(app, {
      messages: [
        { role: 'user', content: 'How do I create a sale?' },
      ],
    });

    assert.equal(res.status, 200);
    assert.equal(
      res.body.reply,
      'To create a sale, go to the POS page and click Complete Sale.'
    );
    assert.ok(capturedBody);
    assert.equal(capturedBody.messages.length, 1);
    assert.equal(capturedBody.max_tokens, 800);
    assert.match(capturedBody.system, /JILE Electronics/i);
  });

  it('caps messages at 2000 chars and keeps at most the last 12 messages', async () => {
    let capturedBody = null;
    global.fetch = async (url, options) => {
      if (typeof url === 'string' && url.includes('anthropic.com')) {
        capturedBody = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            content: [{ type: 'text', text: 'Answer' }],
          }),
        };
      }
      return originalFetch(url, options);
    };

    const lotsOfMessages = [];
    for (let i = 0; i < 20; i++) {
      lotsOfMessages.push({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i} `.repeat(300), // > 2000 chars
      });
    }

    const app = createTestApp();
    const res = await makeRequest(app, { messages: lotsOfMessages });
    assert.equal(res.status, 200);
    assert.ok(capturedBody.messages.length <= 12);
    for (const msg of capturedBody.messages) {
      assert.ok(msg.content.length <= 2000);
    }
  });

  it('rate limits to 20 requests per minute with 429', async () => {
    global.fetch = async (url, options) => {
      if (typeof url === 'string' && url.includes('anthropic.com')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            content: [{ type: 'text', text: 'OK' }],
          }),
        };
      }
      return originalFetch(url, options);
    };

    const app = createTestApp();
    const server = app.listen(0);
    const port = server.address().port;

    try {
      let lastStatus = 0;
      for (let i = 0; i < 22; i++) {
        const res = await fetch(`http://127.0.0.1:${port}/api/assistant`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid-test-token',
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: `ping ${i}` }],
          }),
        });
        lastStatus = res.status;
        if (i >= 20) {
          assert.equal(lastStatus, 429);
        }
      }
    } finally {
      server.close();
    }
  });
});
