const mongoose = require('mongoose');

const customerPaymentSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    amount: { type: Number, required: true, min: 0.01 },
    previousDebt: { type: Number, required: true, min: 0 },
    remainingDebt: { type: Number, required: true, min: 0 },
    method: { type: String, enum: ['cash', 'card', 'transfer', 'other'], default: 'cash' },
    notes: { type: String, default: '' },
    allocations: [
      {
        sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
        amount: { type: Number, min: 0 },
      },
    ],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

customerPaymentSchema.index({ customer: 1, date: -1 });

module.exports = mongoose.model('CustomerPayment', customerPaymentSchema);
