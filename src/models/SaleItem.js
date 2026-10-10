const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema(
  {
    sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    sku: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    sellingPrice: { type: Number, required: true, min: 0 },
    costPrice: { type: Number, min: 0 },
    purchasePrice: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

saleItemSchema.pre('save', function (next) {
  if (this.costPrice === undefined || this.costPrice === null) {
    this.costPrice = this.purchasePrice;
  }
  if (this.purchasePrice === undefined || this.purchasePrice === null) {
    this.purchasePrice = this.costPrice;
  }
  next();
});

module.exports = mongoose.model('SaleItem', saleItemSchema);
