const { body } = require('express-validator');
const { Expense } = require('../models');
const { success, paginated } = require('../utils/apiResponse');
const { parsePagination, paginationMeta } = require('../utils/pagination');
const { resolvePeriod } = require('../utils/dateRange');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { escapeRegex } = require('../utils/escapeRegex');

const expenseValidators = [
  body('name').trim().notEmpty().withMessage('Expense name is required'),
  body('category').isIn(['Rent', 'Electricity', 'Transport', 'Salary', 'Internet', 'Other']),
  body('amount').isFloat({ min: 0 }).withMessage('Amount is required'),
  body('date').notEmpty().withMessage('Date is required'),
];

const listExpenses = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = parsePagination({ ...req.query, sort: req.query.sort || 'date' });
  const filter = {};
  if (req.query.search) filter.name = new RegExp(escapeRegex(req.query.search), 'i');
  if (req.query.category) filter.category = req.query.category;
  const range = resolvePeriod(req.query);
  if (range) filter.date = { $gte: range.from, $lte: range.to };

  const [items, total] = await Promise.all([
    Expense.find(filter).populate('createdBy', 'name').sort(sort).skip(skip).limit(limit),
    Expense.countDocuments(filter),
  ]);
  paginated(res, items, paginationMeta(total, page, limit));
});

const createExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.create({ ...req.body, createdBy: req.user._id });
  success(res, { expense }, 'Expense created', 201);
});

const updateExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!expense) throw new AppError('Expense not found.', 404);
  success(res, { expense }, 'Expense updated');
});

const deleteExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findByIdAndDelete(req.params.id);
  if (!expense) throw new AppError('Expense not found.', 404);
  success(res, {}, 'Expense deleted');
});

module.exports = { listExpenses, createExpense, updateExpense, deleteExpense, expenseValidators };
