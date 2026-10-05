const { body } = require('express-validator');
const { StockMovement, Product } = require('../models');
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
      .populate('createdBy', 'name')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    StockMovement.countDocuments(filter),
  ]);
  paginated(res, items, paginationMeta(total, page, limit));
});

const adjustStock = asyncHandler(async (req, res) => {
  const { product, quantity, type, reason, notes } = req.body;
  const exists = await Product.findById(product);
  if (!exists || exists.isDeleted) throw new AppError('Product not found.', 404);

  const result = await applyStockChange({
    productId: product,
    quantity,
    type,
    reason,
    referenceType: 'adjustment',
    referenceNumber: 'ADJ',
    notes,
    createdBy: req.user._id,
  });

  success(res, result, 'Stock updated', 201);
});

module.exports = { listMovements, adjustStock, adjustValidators };
