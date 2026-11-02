const { body } = require('express-validator');
const { StockMovement, Product, Supplier } = require('../models');
const { applyStockChange } = require('../services/stockService');
const { success, paginated } = require('../utils/apiResponse');
const { parsePagination, paginationMeta } = require('../utils/pagination');
const { resolvePeriod } = require('../utils/dateRange');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { escapeRegex } = require('../utils/escapeRegex');

const adjustValidators = [
  body('product').notEmpty().withMessage('Product is required'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('type').isIn(['in', 'out']).withMessage('Type must be in or out'),
  body('reason').isIn(['adjustment_in', 'adjustment_out', 'damaged', 'lost']).withMessage('Invalid reason'),
];

const addStockValidators = [
  body('product').notEmpty().withMessage('Product is required'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity to add must be at least 1'),
  body('purchaseCost').optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage('Purchase cost cannot be negative'),
];

const listMovements = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = parsePagination({ ...req.query, sort: req.query.sort || 'date' });
  const filter = {};
  if (req.query.product) filter.product = req.query.product;
  if (req.query.type && req.query.type !== 'all') filter.type = req.query.type;
  const range = resolvePeriod(req.query);
  if (range) filter.date = { $gte: range.from, $lte: range.to };
  if (req.query.search) {
    filter.referenceNumber = new RegExp(escapeRegex(req.query.search), 'i');
  }

  const [items, total] = await Promise.all([
    StockMovement.find(filter)
      .populate('product', 'name sku currentStock minStock')
      .populate('supplier', 'name company phone')
      .populate('createdBy', 'name')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    StockMovement.countDocuments(filter),
  ]);
  paginated(res, items, paginationMeta(total, page, limit));
});

const adjustStock = asyncHandler(async (req, res) => {
  const { product, quantity, type, reason, notes, supplier, purchaseCost } = req.body;
  const exists = await Product.findById(product);
  if (!exists || exists.isDeleted) throw new AppError('Product not found.', 404);

  const result = await applyStockChange({
    productId: product,
    quantity,
    type,
    reason,
    referenceType: 'adjustment',
    referenceNumber: 'ADJ',
    supplier: supplier || null,
    purchaseCost: purchaseCost ? Number(purchaseCost) : undefined,
    notes,
    createdBy: req.user._id,
  });

  success(res, result, 'Stock updated', 201);
});

const addStock = asyncHandler(async (req, res) => {
  const { product: productId, quantity, supplier, purchaseCost, date, notes } = req.body;
  const qty = Number(quantity);
  if (isNaN(qty) || qty <= 0) {
    throw new AppError('Quantity to add must be at least 1.', 400);
  }

  const product = await Product.findOne({ _id: productId, isDeleted: false });
  if (!product) throw new AppError('Product not found.', 404);

  if (supplier) {
    const supplierExists = await Supplier.findById(supplier);
    if (!supplierExists) throw new AppError('Selected supplier not found.', 404);
  }

  const cost = purchaseCost !== undefined && purchaseCost !== null && purchaseCost !== ''
    ? Number(purchaseCost)
    : product.purchasePrice;

  if (isNaN(cost) || cost < 0) {
    throw new AppError('Purchase cost cannot be negative.', 400);
  }

  const result = await applyStockChange({
    productId: product._id,
    quantity: qty,
    type: 'in',
    reason: 'restock',
    referenceType: 'restock',
    referenceNumber: 'RESTOCK',
    supplier: supplier || null,
    purchaseCost: cost,
    notes: notes || 'Stock added',
    createdBy: req.user._id,
    date: date ? new Date(date) : new Date(),
  });

  const freshProduct = await Product.findById(product._id).populate('category');
  const freshMovement = await StockMovement.findById(result.movement._id)
    .populate('supplier', 'name company phone')
    .populate('createdBy', 'name');

  success(
    res,
    { product: freshProduct, movement: freshMovement },
    `Added ${qty} units to ${product.name}. New total stock: ${freshProduct.currentStock} (${freshProduct.stockStatus}).`,
    200
  );
});

module.exports = { listMovements, adjustStock, adjustValidators, addStock, addStockValidators };
