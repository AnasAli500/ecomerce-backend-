const { body } = require('express-validator');
const { Product } = require('../models');
const { applyStockChange } = require('../services/stockService');
const { success, paginated } = require('../utils/apiResponse');
const { parsePagination, paginationMeta } = require('../utils/pagination');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

const productValidators = [
  body('name').trim().notEmpty().withMessage('Product name is required'),
  body('sku').trim().notEmpty().withMessage('SKU is required'),
  body('category').notEmpty().withMessage('Category is required'),
  body('sellingPrice').isFloat({ min: 0 }).withMessage('Selling price is required'),
  body('purchasePrice').isFloat({ min: 0 }).withMessage('Purchase price is required'),
  body('minStock').optional().isFloat({ min: 0 }),
];

const listProducts = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = parsePagination(req.query);
  const filter = { isDeleted: false };
  if (req.query.search) {
    filter.$or = [
      { name: new RegExp(req.query.search, 'i') },
      { sku: new RegExp(req.query.search, 'i') },
    ];
  }
  if (req.query.category) filter.category = req.query.category;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.lowStock === 'true') {
    filter.$expr = { $lte: ['$currentStock', '$minStock'] };
  }

  const [items, total] = await Promise.all([
    Product.find(filter).populate('category').sort(sort).skip(skip).limit(limit),
    Product.countDocuments(filter),
  ]);
  paginated(res, items, paginationMeta(total, page, limit));
});

const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, isDeleted: false }).populate('category');
  if (!product) throw new AppError('Product not found.', 404);
  success(res, { product });
});

const createProduct = asyncHandler(async (req, res) => {
  const { name, sku, category, sellingPrice, purchasePrice, minStock, description, status } = req.body;
  const payload = { name, sku, category, sellingPrice, purchasePrice, minStock, description, status, currentStock: 0 };
  if (req.file) payload.image = `/uploads/${req.file.filename}`;
  const initialStock = Number(req.body.currentStock || 0);

  const product = await Product.create(payload);

  if (initialStock > 0) {
    await applyStockChange({
      productId: product._id,
      quantity: initialStock,
      type: 'in',
      reason: 'new_product',
      referenceType: 'product',
      referenceId: product._id,
      referenceNumber: product.sku,
      notes: 'Initial stock',
      createdBy: req.user._id,
    });
  }

  const fresh = await Product.findById(product._id).populate('category');
  success(res, { product: fresh }, 'Product created', 201);
});

const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, isDeleted: false });
  if (!product) throw new AppError('Product not found.', 404);

  const fields = ['name', 'sku', 'category', 'sellingPrice', 'purchasePrice', 'minStock', 'description', 'status'];
  fields.forEach((field) => {
    if (req.body[field] !== undefined) product[field] = req.body[field];
  });
  if (req.file) product.image = `/uploads/${req.file.filename}`;
  await product.save();

  const fresh = await Product.findById(product._id).populate('category');
  success(res, { product: fresh }, 'Product updated');
});

const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, isDeleted: false });
  if (!product) throw new AppError('Product not found.', 404);
  product.isDeleted = true;
  product.status = 'inactive';
  await product.save();
  success(res, {}, 'Product archived. Historical records are kept.');
});

module.exports = {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  productValidators,
};
