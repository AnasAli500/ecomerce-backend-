const { body } = require('express-validator');
const { Customer, Sale, CustomerPayment } = require('../models');
const { success, paginated } = require('../utils/apiResponse');
const { parsePagination, paginationMeta } = require('../utils/pagination');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { escapeRegex } = require('../utils/escapeRegex');

const customerValidators = [
  body('name').trim().notEmpty().withMessage('Name is required'),
];

const listCustomers = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = parsePagination(req.query);
  const filter = {};
  if (req.query.search) {
    filter.$or = [
      { name: new RegExp(escapeRegex(req.query.search), 'i') },
      { phone: new RegExp(escapeRegex(req.query.search), 'i') },
      { email: new RegExp(escapeRegex(req.query.search), 'i') },
    ];
  }
  if (req.query.status) filter.status = req.query.status;
  if (req.query.debt === 'true') filter.totalDebt = { $gt: 0 };

  const [items, total] = await Promise.all([
    Customer.find(filter).sort(sort).skip(skip).limit(limit),
    Customer.countDocuments(filter),
  ]);
  paginated(res, items, paginationMeta(total, page, limit));
});

const getCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw new AppError('Customer not found.', 404);

  const [sales, payments] = await Promise.all([
    Sale.find({ customer: customer._id }).populate('items').sort({ date: -1 }),
    CustomerPayment.find({ customer: customer._id }).sort({ date: -1 }),
  ]);

  success(res, {
    customer,
    sales,
    payments,
    remainingBalance: customer.totalDebt,
  });
});

const createCustomer = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    throw new AppError('Customer name is required.', 400);
  }
  const existing = await Customer.findOne({
    name: { $regex: new RegExp(`^${name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
  });
  if (existing) {
    return success(res, { customer: existing, isExisting: true }, 'Existing customer found', 200);
  }
  const customer = await Customer.create(req.body);
  success(res, { customer }, 'Customer created', 201);
});

const updateCustomer = asyncHandler(async (req, res) => {
  const allowed = ['name', 'phone', 'email', 'address', 'status'];
  const payload = {};
  allowed.forEach((key) => {
    if (req.body[key] !== undefined) payload[key] = req.body[key];
  });
  const customer = await Customer.findByIdAndUpdate(req.params.id, payload, {
    new: true,
    runValidators: true,
  });
  if (!customer) throw new AppError('Customer not found.', 404);
  success(res, { customer }, 'Customer updated');
});

const deleteCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw new AppError('Customer not found.', 404);
  if (customer.totalDebt > 0) throw new AppError('Cannot delete a customer with outstanding debt.');
  await customer.deleteOne();
  success(res, {}, 'Customer deleted');
});

module.exports = {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  customerValidators,
};
