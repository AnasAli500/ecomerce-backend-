const mongoose = require('mongoose');

const aiAuditLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userEmail: { type: String, default: '' },
    userRole: { type: String, default: 'staff' },
    actionType: {
      type: String,
      required: true,
      enum: [
        'create_product',
        'update_product',
        'adjust_stock',
        'record_customer_payment',
        'record_expense',
        'record_purchase',
      ],
    },
    actionSummary: { type: String, required: true },
    parameters: { type: mongoose.Schema.Types.Mixed, default: {} },
    result: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ['success', 'failed'], default: 'success' },
    errorMessage: { type: String, default: '' },
    ip: { type: String, default: '' },
  },
  { timestamps: true }
);

aiAuditLogSchema.index({ createdAt: -1 });
aiAuditLogSchema.index({ user: 1, createdAt: -1 });
aiAuditLogSchema.index({ actionType: 1 });

module.exports = mongoose.model('AiAuditLog', aiAuditLogSchema);
