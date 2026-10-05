const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    items: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SaleItem' }],
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    paid: { type: Number, required: true, min: 0 },
    debt: { type: Number, required: true, min: 0 },
    paymentStatus: { type: String, enum: ['Paid', 'Partial', 'Unpaid'], required: true },
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

saleSchema.index({ date: -1 });
saleSchema.index({ customer: 1 });

module.exports = mongoose.model('Sale', saleSchema);
