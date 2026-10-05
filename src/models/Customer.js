const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: '', trim: true },
    email: { type: String, default: '', trim: true, lowercase: true },
    address: { type: String, default: '' },
    totalPurchases: { type: Number, default: 0, min: 0 },
    totalPaid: { type: Number, default: 0, min: 0 },
    totalDebt: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true }
);

customerSchema.index({ name: 'text', phone: 'text', email: 'text' });

customerSchema.virtual('debtStatus').get(function debtStatus() {
  if (this.totalDebt <= 0) return 'Paid';
  if (this.totalPaid > 0 && this.totalDebt > 0) return 'Partial';
  return 'Unpaid';
});

customerSchema.set('toJSON', { virtuals: true });
customerSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Customer', customerSchema);
