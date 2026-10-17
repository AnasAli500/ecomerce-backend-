const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { SYSTEM_KNOWLEDGE } = require('../services/aiKnowledge');
const {
  getProfitMetrics,
  prepareAdjustStock,
  prepareCustomerPayment,
  prepareExpense,
  prepareAddProduct,
  executeConfirmedAction,
  stagedActions,
} = require('../services/aiDataService');
const {
  fallbackLocalEngine,
  detectPeriod,
  detectIsSomali,
  matchGeneralKnowledge,
  matchSystemHowTo,
  processChatMessage,
} = require('../services/aiService');
const AppError = require('../utils/AppError');

describe('AI Assistant Knowledge & Business Rules', () => {
  it('covers all 17 system modules with step-by-step procedures in English and Somali', () => {
    const modules = [
      'dashboard',
      'products',
      'categories',
      'stock',
      'sales',
      'salesHistory',
      'receipts',
      'purchases',
      'customers',
      'customerDebts',
      'customerPayments',
      'suppliers',
      'expenses',
      'reports',
      'profitReport',
      'users',
      'settings',
    ];

    for (const mod of modules) {
      assert.ok(SYSTEM_KNOWLEDGE.modules[mod], `Module ${mod} must exist in SYSTEM_KNOWLEDGE`);
      assert.ok(SYSTEM_KNOWLEDGE.modules[mod].name, `Module ${mod} must have a name`);
      assert.ok(SYSTEM_KNOWLEDGE.modules[mod].somali, `Module ${mod} must have Somali explanation`);
      assert.ok(SYSTEM_KNOWLEDGE.modules[mod].howTo, `Module ${mod} must have howTo instructions`);
      assert.ok(
        SYSTEM_KNOWLEDGE.modules[mod].howTo.en.length > 0,
        `Module ${mod} must have English howTo steps`
      );
      assert.ok(
        SYSTEM_KNOWLEDGE.modules[mod].howTo.so.length > 0,
        `Module ${mod} must have Somali howTo steps`
      );
    }
  });

  it('enforces Admin-only authorization on profit metrics', async () => {
    const staffUser = { _id: 'user-staff', role: 'staff', name: 'Staff Member' };
    const adminUser = { _id: 'user-admin', role: 'admin', name: 'Admin Boss' };

    // Staff access attempt
    const staffResult = await getProfitMetrics({ period: 'today', userRole: staffUser.role });
    assert.equal(staffResult.authorized, false);
    assert.match(staffResult.error, /Permission Denied/i);
    assert.match(staffResult.errorSo, /Kuma lihid ogolaansho/i);

    // Verify staff query through engine returns denial, not dashboard
    const engineStaff = await fallbackLocalEngine('How much profit did we make today?', [], staffUser);
    assert.match(engineStaff.reply, /Permission Denied/i);
    assert.ok(!engineStaff.reply.includes('Live Business Dashboard'));
  });

  it('validates expense staging with required fields and valid categories', async () => {
    const adminUser = { _id: 'user-admin', role: 'admin' };

    const preview = await prepareExpense(
      {
        name: 'Office Electricity',
        category: 'Electricity',
        amount: 85.5,
        description: 'Monthly power bill',
      },
      adminUser
    );

    assert.ok(preview.actionId);
    assert.ok(preview.token);
    assert.equal(preview.actionType, 'record_expense');
    assert.equal(preview.details.amount, 85.5);
    assert.equal(preview.details.category, 'Electricity');
    assert.equal(preview.parameters.name, 'Office Electricity');

    // Confirm it is registered in staged actions
    assert.ok(stagedActions.has(preview.actionId));

    // Cleanup
    stagedActions.delete(preview.actionId);
  });

  it('rejects expense staging with invalid or zero amount', async () => {
    const adminUser = { _id: 'user-admin', role: 'admin' };

    await assert.rejects(
      async () => {
        await prepareExpense({ name: 'Coffee', category: 'Other', amount: 0 }, adminUser);
      },
      (err) => {
        assert.ok(err instanceof AppError);
        assert.match(err.message, /valid amount/i);
        return true;
      }
    );
  });

  it('protects action confirmation with security token and single-use consumption', async () => {
    const adminUser = { _id: 'user-admin', role: 'admin', email: 'admin@jile.com' };

    // Stage an expense
    const preview = await prepareExpense(
      {
        name: 'Internet Subscription',
        category: 'Internet',
        amount: 50,
      },
      adminUser
    );

    // Attempt execution with incorrect token
    await assert.rejects(
      async () => {
        await executeConfirmedAction({
          actionId: preview.actionId,
          token: 'wrong-token-123',
          user: adminUser,
        });
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.match(err.message, /Invalid security token/i);
        return true;
      }
    );

    // Cleanup
    stagedActions.delete(preview.actionId);
  });

  it('answers system questions in Somali naturally and never dumps an unasked dashboard', async () => {
    const staffUser = { _id: 'user-1', name: 'Ali', role: 'staff' };
    const result = await fallbackLocalEngine('Sidee alaab cusub ugu daraa?', [], staffUser);

    assert.ok(result.reply);
    assert.match(result.reply, /Tallaabooyinka/i);
    assert.match(result.reply, /Products/i);
    assert.ok(!result.reply.includes('Live Business Dashboard'));
    assert.ok(!result.reply.includes('Xogta Guud ee Maanta:'));
  });

  it('answers POS questions in English naturally and step-by-step', async () => {
    const staffUser = { _id: 'user-1', name: 'John', role: 'staff' };
    const result = await fallbackLocalEngine('How do I create a new sale in POS?', [], staffUser);

    assert.ok(result.reply);
    assert.match(result.reply, /How to Create a New Sale/i);
    assert.match(result.reply, /Step 1/i);
    assert.ok(!result.reply.includes('Live Business Dashboard'));
  });

  it('answers customer debt viewing instructions in Somali', async () => {
    const staffUser = { _id: 'user-1', name: 'Ali', role: 'staff' };
    const result = await fallbackLocalEngine('Sidee loo eegaa deymaha macaamiisha?', [], staffUser);

    assert.ok(result.reply);
    assert.match(result.reply, /Daymaha/i);
    assert.ok(!result.reply.includes('Live Business Dashboard'));
  });

  it('handles spelling mistakes and informal wording in English queries', async () => {
    const staffUser = { _id: 'user-1', name: 'John', role: 'staff' };
    // "how to mak a sel in pos"
    const result = await fallbackLocalEngine('how to mak a sel in pos', [], staffUser);

    assert.ok(result.reply);
    assert.match(result.reply, /Sale|POS/i);
    assert.ok(!result.reply.includes('Live Business Dashboard'));
  });

  it('answers general knowledge electronics questions (Ohm\'s Law, Capacitor, RAM, SSD)', async () => {
    const user = { _id: 'user-1', name: 'Farhan', role: 'staff' };

    // Ohm's law in English
    const ohmsEn = await fallbackLocalEngine('What is Ohm\'s law?', [], user);
    assert.match(ohmsEn.reply, /Ohm's Law/i);
    assert.match(ohmsEn.reply, /V = I/i);
    assert.ok(!ohmsEn.reply.includes('Live Business Dashboard'));

    // Capacitor in Somali
    const capSo = await fallbackLocalEngine('Waa maxay capacitor?', [], user);
    assert.match(capSo.reply, /Capacitor|Kondhansar/i);
    assert.ok(!capSo.reply.includes('Live Business Dashboard'));

    // SSD vs HDD
    const ssd = await fallbackLocalEngine('Explain difference between SSD and HDD', [], user);
    assert.match(ssd.reply, /SSD vs HDD/i);
    assert.ok(!ssd.reply.includes('Live Business Dashboard'));
  });

  it('evaluates math and percentage calculations directly', async () => {
    const user = { _id: 'user-1', name: 'Test', role: 'staff' };

    const calc1 = await fallbackLocalEngine('What is 250 * 4?', [], user);
    assert.match(calc1.reply, /1000/);

    const calc2 = await fallbackLocalEngine('calculate 15% of 800', [], user);
    assert.match(calc2.reply, /120/);
  });

  it('answers world & geography questions (e.g. Capital of Somalia)', async () => {
    const user = { _id: 'user-1', name: 'Test', role: 'staff' };
    const res = await fallbackLocalEngine('What is the capital of Somalia?', [], user);
    assert.match(res.reply, /Mogadishu|Muqdisho/i);
    assert.ok(!res.reply.includes('Live Business Dashboard'));
  });

  it('responds politely to greetings without dumping unasked business data', async () => {
    const user = { _id: 'user-1', name: 'Test', role: 'staff' };

    const hiEn = await fallbackLocalEngine('Hello', [], user);
    assert.match(hiEn.reply, /Welcome to JILE Electronics/i);
    assert.ok(!hiEn.reply.includes('Sales Revenue: $'));

    const ascSo = await fallbackLocalEngine('Asc', [], user);
    assert.match(ascSo.reply, /Ku soo dhowow/i);
    assert.ok(!ascSo.reply.includes('Iibka Maanta: $'));
  });

  it('asks a clarifying follow-up question when user input is ambiguous', async () => {
    const user = { _id: 'user-1', name: 'Test', role: 'staff' };
    const res = await fallbackLocalEngine('xyz123 unclear message', [], user);

    assert.ok(res.reply);
    assert.match(res.reply, /clarify|accurate|fahmi waayay/i);
    assert.ok(!res.reply.includes('Live Business Dashboard'));
  });

  it('asks follow-up questions when action details are missing (e.g. Record Expense without amount)', async () => {
    const user = { _id: 'user-1', name: 'Test', role: 'admin' };
    const res = await fallbackLocalEngine('Record an expense', [], user);

    assert.ok(res.reply);
    assert.match(res.reply, /amount|category|cadadka/i);
    assert.equal(res.actionProposal, null);
  });

  it('detects time periods accurately including Somali and follow-up turns', () => {
    assert.equal(detectPeriod('How much did I sell today?'), 'today');
    assert.equal(detectPeriod('Immisa ayaan iibiyay maanta?'), 'today');
    assert.equal(detectPeriod('sales yesterday'), 'yesterday');
    assert.equal(detectPeriod('iibka shalay'), 'yesterday');
    assert.equal(detectPeriod('this week sales'), 'this_week');
    assert.equal(detectPeriod('todobaadkan iibkiisa'), 'this_week');
    assert.equal(detectPeriod('this month profit'), 'this_month');
    assert.equal(detectPeriod('bishan faa\'iidada'), 'this_month');

    // Follow-up context
    const history = [{ role: 'assistant', content: 'Today sales were $500' }];
    assert.equal(detectPeriod('What about yesterday?', history), 'yesterday');
  });

  it('accurately identifies Somali vs English queries', () => {
    assert.equal(detectIsSomali('Immisa ayaan iibiyay maanta?'), true);
    assert.equal(detectIsSomali('Sidee alaab cusub loogu daraa nidaamka?'), true);
    assert.equal(detectIsSomali('How do I create a new sale?'), false);
    assert.equal(detectIsSomali('What is Ohm\'s law?'), false);
  });

  it('processes chat messages via processChatMessage and extracts user intent reliably', async () => {
    const user = { _id: 'user-1', name: 'Tester', email: 'test@jile.com', role: 'admin' };

    const result = await processChatMessage({
      messages: [
        { role: 'assistant', content: 'Welcome to JILE Electronics AI Assistant!' },
        { role: 'user', content: 'What is Ohm\'s law?' },
      ],
      user,
    });

    assert.ok(result.message);
    assert.match(result.message, /Ohm's Law/i);
    assert.match(result.message, /V = I/i);
    assert.ok(!result.message.includes('Live Business Dashboard'));
  });
});
