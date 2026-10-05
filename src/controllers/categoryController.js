const { body } = require('express-validator');
const { Category, Product } = require('../models');
const { success, paginated } = require('../utils/apiResponse');
const { parsePagination, paginationMeta } = require('../utils/pagination');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { escapeRegex } = require('../utils/escapeRegex');

const categoryValidators = [
  body('name').trim().notEmpty().withMessage('Category name is required'),
];

const listCategories = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = parsePagination(req.query);
  const filter = {};
  if (req.query.search) filter.name = new RegExp(escapeRegex(req.query.search), 'i');
  if (req.query.status) filter.status = req.query.status;

  const [items, total] = await Promise.all([
    Category.find(filter).sort(sort).skip(skip).limit(limit),
    Category.countDocuments(filter),
  ]);
  paginated(res, items, paginationMeta(total, page, limit));
});

const createCategory = asyncHandler(async (req, res) => {
  const category = await Category.create(req.body);
  success(res, { category }, 'Category created', 201);
});

const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!category) throw new AppError('Category not found.', 404);
  success(res, { category }, 'Category updated');
});

const deleteCategory = asyncHandler(async (req, res) => {
  const inUse = await Product.exists({ category: req.params.id, isDeleted: false });
  if (inUse) throw new AppError('Cannot delete a category that has products.');
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) throw new AppError('Category not found.', 404);
  success(res, {}, 'Category deleted');
});

module.exports = {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  categoryValidators,
};
