const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    items: [{ type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseItem' }],
    total: { type: Number, required: true, min: 0 },
    paid: { type: Number, required: true, min: 0 },
    remaining: { type: Number, required: true, min: 0 },
    paymentStatus: { type: String, enum: ['Paid', 'Partial', 'Unpaid'], required: true },
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

purchaseSchema.index({ date: -1 });

module.exports = mongoose.model('Purchase', purchaseSchema);
