const { Product, StockMovement } = require('../models');
const AppError = require('../utils/AppError');

async function applyStockChange({
  productId,
  quantity,
  type,
  reason,
  referenceType,
  referenceId,
  referenceNumber,
  notes,
  createdBy,
  date,
}) {
  const qty = Number(quantity);
  if (!qty || qty <= 0) {
    throw new AppError('Quantity must be greater than 0.');
  }

  const product = await Product.findById(productId);
  if (!product || product.isDeleted) {
    throw new AppError('Product not found.', 404);
  }

  const previousStock = product.currentStock;
  const newStock = type === 'in' ? previousStock + qty : previousStock - qty;

  if (newStock < 0) {
    throw new AppError(`Insufficient stock for ${product.name}. Available: ${previousStock}.`);
  }

  product.currentStock = newStock;
  await product.save();

  const movement = await StockMovement.create({
    product: product._id,
    type,
    quantity: qty,
    previousStock,
    newStock,
    reason,
    referenceType: referenceType || '',
    referenceId: referenceId || null,
    referenceNumber: referenceNumber || '',
    notes: notes || '',
    createdBy,
    date: date || new Date(),
  });

  return { product, movement };
}

module.exports = { applyStockChange };
