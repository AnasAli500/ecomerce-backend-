const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    type: { type: String, enum: ['in', 'out'], required: true },
    quantity: { type: Number, required: true, min: 1 },
    previousStock: { type: Number, required: true, min: 0 },
    newStock: { type: Number, required: true, min: 0 },
    reason: {
      type: String,
      enum: [
        'purchase',
        'sale',
        'new_product',
        'adjustment_in',
        'adjustment_out',
        'damaged',
        'lost',
        'sale_edit_reversal',
        'sale_deleted',
      ],
      required: true,
    },
    referenceType: { type: String, default: '' },
    referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    referenceNumber: { type: String, default: '' },
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

stockMovementSchema.index({ product: 1, date: -1 });
stockMovementSchema.index({ type: 1, date: -1 });

module.exports = mongoose.model('StockMovement', stockMovementSchema);
