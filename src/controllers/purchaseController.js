const { body } = require('express-validator');
const { Purchase, PurchaseItem, Product, Supplier } = require('../models');
const { applyStockChange } = require('../services/stockService');
const { nextNumber } = require('../utils/invoice');
const { paymentStatus, roundMoney } = require('../utils/money');
const { success, paginated } = require('../utils/apiResponse');
const { parsePagination, paginationMeta } = require('../utils/pagination');
const { resolvePeriod } = require('../utils/dateRange');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { escapeRegex } = require('../utils/escapeRegex');

const purchaseValidators = [
  body('supplier').notEmpty().withMessage('Supplier is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one product is required'),
  body('paid').isFloat({ min: 0 }).withMessage('Paid amount is required'),
];

const listPurchases = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = parsePagination(req.query);
  const filter = {};
  if (req.query.search) filter.invoiceNumber = new RegExp(escapeRegex(req.query.search), 'i');
  if (req.query.supplier) filter.supplier = req.query.supplier;
  if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;
  const range = resolvePeriod(req.query);
  if (range) filter.date = { $gte: range.from, $lte: range.to };

  const [items, total] = await Promise.all([
    Purchase.find(filter)
      .populate('supplier', 'name company phone')
      .populate('createdBy', 'name')
      .populate('items')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Purchase.countDocuments(filter),
  ]);
  paginated(res, items, paginationMeta(total, page, limit));
});

const getPurchase = asyncHandler(async (req, res) => {
  const purchase = await Purchase.findById(req.params.id)
    .populate('supplier')
    .populate('createdBy', 'name')
    .populate('items');
  if (!purchase) throw new AppError('Purchase not found.', 404);
  success(res, { purchase });
});

const createPurchase = asyncHandler(async (req, res) => {
  const { supplier: supplierId, items, paid, notes } = req.body;
  const supplier = await Supplier.findById(supplierId);
  if (!supplier) throw new AppError('Supplier not found.', 404);

  let total = 0;
  const prepared = [];

  for (const item of items) {
    const product = await Product.findById(item.product);
    if (!product || product.isDeleted) throw new AppError('Product not found.');
    const qty = Number(item.quantity);
    const price = Number(item.purchasePrice ?? product.purchasePrice);
    if (qty <= 0) throw new AppError('Quantity must be greater than 0.');
    const lineTotal = roundMoney(price * qty);
    total += lineTotal;
    prepared.push({ product, quantity: qty, purchasePrice: price, lineTotal });
  }

  total = roundMoney(total);
  const paidAmount = roundMoney(Math.min(Number(paid) || 0, total));
  const remaining = roundMoney(total - paidAmount);
  const invoiceNumber = await nextNumber('purchase', 'PUR');

  const purchase = await Purchase.create({
    invoiceNumber,
    supplier: supplier._id,
    total,
    paid: paidAmount,
    remaining,
    paymentStatus: paymentStatus(paidAmount, total),
    notes: notes || '',
    createdBy: req.user._id,
    date: req.body.date ? new Date(req.body.date) : new Date(),
    items: [],
  });

  const createdItems = [];
  for (const row of prepared) {
    const purchaseItem = await PurchaseItem.create({
      purchase: purchase._id,
      product: row.product._id,
      productName: row.product.name,
      sku: row.product.sku,
      quantity: row.quantity,
      purchasePrice: row.purchasePrice,
      lineTotal: row.lineTotal,
    });
    createdItems.push(purchaseItem._id);

    row.product.purchasePrice = row.purchasePrice;
    await row.product.save();

    await applyStockChange({
      productId: row.product._id,
      quantity: row.quantity,
      type: 'in',
      reason: 'purchase',
      referenceType: 'purchase',
      referenceId: purchase._id,
      referenceNumber: invoiceNumber,
      createdBy: req.user._id,
    });
  }

  purchase.items = createdItems;
  await purchase.save();

  supplier.totalPurchases = roundMoney(supplier.totalPurchases + total);
  supplier.amountPaid = roundMoney(supplier.amountPaid + paidAmount);
  supplier.amountDue = roundMoney(supplier.amountDue + remaining);
  await supplier.save();

  const fresh = await Purchase.findById(purchase._id)
    .populate('supplier')
    .populate('createdBy', 'name')
    .populate('items');
  success(res, { purchase: fresh }, 'Purchase recorded', 201);
});

module.exports = { listPurchases, getPurchase, createPurchase, purchaseValidators };
