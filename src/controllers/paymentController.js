const { body } = require('express-validator');
const { Customer, Sale, CustomerPayment, Supplier, Purchase, SupplierPayment } = require('../models');
const { paymentStatus, roundMoney } = require('../utils/money');
const { success, paginated } = require('../utils/apiResponse');
const { parsePagination, paginationMeta } = require('../utils/pagination');
const { resolvePeriod } = require('../utils/dateRange');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

const customerPaymentValidators = [
  body('customer').notEmpty().withMessage('Customer is required'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
];

const supplierPaymentValidators = [
  body('supplier').notEmpty().withMessage('Supplier is required'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
];

const listCustomerPayments = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = parsePagination({ ...req.query, sort: req.query.sort || 'date' });
  const filter = {};
  if (req.query.customer) filter.customer = req.query.customer;
  const range = resolvePeriod(req.query);
  if (range) filter.date = { $gte: range.from, $lte: range.to };

  const [items, total] = await Promise.all([
    CustomerPayment.find(filter)
      .populate('customer', 'name phone totalDebt')
      .populate('createdBy', 'name')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    CustomerPayment.countDocuments(filter),
  ]);
  paginated(res, items, paginationMeta(total, page, limit));
});

const createCustomerPayment = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.body.customer);
  if (!customer) throw new AppError('Customer not found.', 404);
  if (customer.totalDebt <= 0) throw new AppError('This customer has no outstanding debt.');

  const amount = roundMoney(Number(req.body.amount));
  if (amount > customer.totalDebt) {
    throw new AppError(`Payment cannot exceed remaining debt of ${customer.totalDebt}.`);
  }

  const previousDebt = customer.totalDebt;
  let remainingToApply = amount;
  const allocations = [];

  const unpaidSales = await Sale.find({
    customer: customer._id,
    debt: { $gt: 0 },
  }).sort({ date: 1 });

  for (const sale of unpaidSales) {
    if (remainingToApply <= 0) break;
    const apply = Math.min(sale.debt, remainingToApply);
    sale.paid = roundMoney(sale.paid + apply);
    sale.debt = roundMoney(sale.debt - apply);
    sale.paymentStatus = paymentStatus(sale.paid, sale.total);
    await sale.save();
    allocations.push({ sale: sale._id, amount: apply });
    remainingToApply = roundMoney(remainingToApply - apply);
  }

  customer.totalPaid = roundMoney(customer.totalPaid + amount);
  customer.totalDebt = roundMoney(customer.totalDebt - amount);
  await customer.save();

  const payment = await CustomerPayment.create({
    customer: customer._id,
    amount,
    previousDebt,
    remainingDebt: customer.totalDebt,
    method: req.body.method || 'cash',
    notes: req.body.notes || '',
    allocations,
    createdBy: req.user._id,
    date: req.body.date ? new Date(req.body.date) : new Date(),
  });

  const populated = await payment.populate('customer createdBy', 'name phone email');
  success(res, { payment: populated, customer }, 'Payment recorded', 201);
});

const listSupplierPayments = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = parsePagination({ ...req.query, sort: req.query.sort || 'date' });
  const filter = {};
  if (req.query.supplier) filter.supplier = req.query.supplier;
  const range = resolvePeriod(req.query);
  if (range) filter.date = { $gte: range.from, $lte: range.to };

  const [items, total] = await Promise.all([
    SupplierPayment.find(filter)
      .populate('supplier', 'name company amountDue')
      .populate('createdBy', 'name')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    SupplierPayment.countDocuments(filter),
  ]);
  paginated(res, items, paginationMeta(total, page, limit));
});

const createSupplierPayment = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findById(req.body.supplier);
  if (!supplier) throw new AppError('Supplier not found.', 404);
  if (supplier.amountDue <= 0) throw new AppError('This supplier has no outstanding balance.');

  const amount = roundMoney(Number(req.body.amount));
  if (amount > supplier.amountDue) {
    throw new AppError(`Payment cannot exceed amount due of ${supplier.amountDue}.`);
  }

  const previousDue = supplier.amountDue;
  let remainingToApply = amount;

  const unpaid = await Purchase.find({
    supplier: supplier._id,
    remaining: { $gt: 0 },
  }).sort({ date: 1 });

  for (const purchase of unpaid) {
    if (remainingToApply <= 0) break;
    const apply = Math.min(purchase.remaining, remainingToApply);
    purchase.paid = roundMoney(purchase.paid + apply);
    purchase.remaining = roundMoney(purchase.remaining - apply);
    purchase.paymentStatus = paymentStatus(purchase.paid, purchase.total);
    await purchase.save();
    remainingToApply = roundMoney(remainingToApply - apply);
  }

  supplier.amountPaid = roundMoney(supplier.amountPaid + amount);
  supplier.amountDue = roundMoney(supplier.amountDue - amount);
  await supplier.save();

  const payment = await SupplierPayment.create({
    supplier: supplier._id,
    amount,
    previousDue,
    remainingDue: supplier.amountDue,
    method: req.body.method || 'cash',
    notes: req.body.notes || '',
    createdBy: req.user._id,
    date: req.body.date ? new Date(req.body.date) : new Date(),
  });

  success(res, { payment, supplier }, 'Supplier payment recorded', 201);
});

module.exports = {
  listCustomerPayments,
  createCustomerPayment,
  listSupplierPayments,
  createSupplierPayment,
  customerPaymentValidators,
  supplierPaymentValidators,
};
