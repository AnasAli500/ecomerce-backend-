const mongoose = require('mongoose');

const supplierPaymentSchema = new mongoose.Schema(
  {
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    amount: { type: Number, required: true, min: 0.01 },
    previousDue: { type: Number, required: true, min: 0 },
    remainingDue: { type: Number, required: true, min: 0 },
    method: { type: String, enum: ['cash', 'card', 'transfer', 'other'], default: 'cash' },
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SupplierPayment', supplierPaymentSchema);
