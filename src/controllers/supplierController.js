const { body } = require('express-validator');
const { Supplier, Purchase, SupplierPayment } = require('../models');
const { success, paginated } = require('../utils/apiResponse');
const { parsePagination, paginationMeta } = require('../utils/pagination');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { escapeRegex } = require('../utils/escapeRegex');

const supplierValidators = [
  body('name').trim().notEmpty().withMessage('Supplier name is required'),
  body('phone').trim().notEmpty().withMessage('Phone is required'),
];

const listSuppliers = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = parsePagination(req.query);
  const filter = {};
  if (req.query.search) {
    filter.$or = [
      { name: new RegExp(escapeRegex(req.query.search), 'i') },
      { company: new RegExp(escapeRegex(req.query.search), 'i') },
      { phone: new RegExp(escapeRegex(req.query.search), 'i') },
    ];
  }
  if (req.query.status) filter.status = req.query.status;

  const [items, total] = await Promise.all([
    Supplier.find(filter).sort(sort).skip(skip).limit(limit),
    Supplier.countDocuments(filter),
  ]);
  paginated(res, items, paginationMeta(total, page, limit));
});

const getSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findById(req.params.id);
  if (!supplier) throw new AppError('Supplier not found.', 404);
  const [purchases, payments] = await Promise.all([
    Purchase.find({ supplier: supplier._id }).populate('items').sort({ date: -1 }),
    SupplierPayment.find({ supplier: supplier._id }).sort({ date: -1 }),
  ]);
  success(res, { supplier, purchases, payments });
});

const createSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.create(req.body);
  success(res, { supplier }, 'Supplier created', 201);
});

const updateSupplier = asyncHandler(async (req, res) => {
  const allowed = ['name', 'phone', 'email', 'address', 'company', 'status'];
  const payload = {};
  allowed.forEach((key) => {
    if (req.body[key] !== undefined) payload[key] = req.body[key];
  });
  const supplier = await Supplier.findByIdAndUpdate(req.params.id, payload, {
    new: true,
    runValidators: true,
  });
  if (!supplier) throw new AppError('Supplier not found.', 404);
  success(res, { supplier }, 'Supplier updated');
});

const deleteSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findById(req.params.id);
  if (!supplier) throw new AppError('Supplier not found.', 404);
  if (supplier.amountDue > 0) throw new AppError('Cannot delete a supplier with outstanding balance.');
  await supplier.deleteOne();
  success(res, {}, 'Supplier deleted');
});

module.exports = {
  listSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  supplierValidators,
};
