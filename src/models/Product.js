const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, unique: true, trim: true, uppercase: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    sellingPrice: { type: Number, required: true, min: 0 },
    purchasePrice: { type: Number, required: true, min: 0 },
    costPrice: { type: Number, min: 0 },
    currentStock: { type: Number, required: true, min: 0, default: 0 },
    minStock: { type: Number, required: true, min: 0, default: 0 },
    image: { type: String, default: '' },
    description: { type: String, default: '' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

productSchema.pre('save', function (next) {
  if ((this.costPrice === undefined || this.costPrice === null) && this.purchasePrice !== undefined) {
    this.costPrice = this.purchasePrice;
  }
  if ((this.purchasePrice === undefined || this.purchasePrice === null) && this.costPrice !== undefined) {
    this.purchasePrice = this.costPrice;
  }
  next();
});

productSchema.index({ name: 'text', sku: 'text' });
productSchema.virtual('isLowStock').get(function isLowStock() {
  return this.currentStock <= this.minStock;
});

productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Product', productSchema);
