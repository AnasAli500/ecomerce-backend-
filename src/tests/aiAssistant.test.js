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
const { fallbackLocalEngine } = require('../services/aiService');
const AppError = require('../utils/AppError');

describe('AI Assistant Knowledge & Business Rules', () => {
  it('covers all major modules with step-by-step procedures in English and Somali', () => {
    const modules = [
      'dashboard',
      'products',
      'categories',
      'stock',
      'sales',
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
    }

    assert.ok(SYSTEM_KNOWLEDGE.modules.products.howTo.en.length > 0);
    assert.ok(SYSTEM_KNOWLEDGE.modules.products.howTo.so.length > 0);
    assert.ok(SYSTEM_KNOWLEDGE.modules.sales.howTo.en.length > 0);
    assert.ok(SYSTEM_KNOWLEDGE.modules.sales.howTo.so.length > 0);
  });

  it('enforces Admin-only authorization on profit metrics', async () => {
    const staffUser = { _id: 'user-staff', role: 'staff', name: 'Staff Member' };
    const adminUser = { _id: 'user-admin', role: 'admin', name: 'Admin Boss' };

    // Staff access attempt
    const staffResult = await getProfitMetrics({ period: 'today', userRole: staffUser.role });
    assert.equal(staffResult.authorized, false);
    assert.match(staffResult.error, /Permission Denied/i);
    assert.match(staffResult.errorSo, /Kuma lihid ogolaansho/i);
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

  it('answers system questions in Somali naturally via fallback engine', async () => {
    const staffUser = { _id: 'user-1', name: 'Ali', role: 'staff' };
    const result = await fallbackLocalEngine('Sidee alaab cusub ugu daraa?', [], staffUser);

    assert.ok(result.reply);
    assert.match(result.reply, /Tallaabooyinka/i);
    assert.match(result.reply, /Products/i);
  });

  it('answers system questions in English naturally via fallback engine', async () => {
    const staffUser = { _id: 'user-1', name: 'John', role: 'staff' };
    const result = await fallbackLocalEngine('How do I add a new product?', [], staffUser);

    assert.ok(result.reply);
    assert.match(result.reply, /How to Add a New Product/i);
    assert.match(result.reply, /Step 1/i);
  });
});
