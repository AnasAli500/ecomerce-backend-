const { body } = require('express-validator');
const { User } = require('../models');
const { success, paginated } = require('../utils/apiResponse');
const { parsePagination, paginationMeta } = require('../utils/pagination');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { escapeRegex } = require('../utils/escapeRegex');

const userValidators = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('role').optional().isIn(['admin', 'staff']),
  body('status').optional().isIn(['active', 'inactive']),
];

const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = parsePagination(req.query);
  const filter = {};
  if (req.query.search) {
    filter.$or = [
      { name: new RegExp(escapeRegex(req.query.search), 'i') },
      { email: new RegExp(escapeRegex(req.query.search), 'i') },
    ];
  }
  if (req.query.role) filter.role = req.query.role;
  if (req.query.status) filter.status = req.query.status;

  const [items, total] = await Promise.all([
    User.find(filter).sort(sort).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  paginated(res, items, paginationMeta(total, page, limit));
});

const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, status, phone } = req.body;
  if (!password || password.length < 6) {
    throw new AppError('Password must be at least 6 characters.', 422);
  }
  const user = await User.create({ name, email, password, role, status, phone });
  success(res, { user }, 'User created', 201);
});

const updateUser = asyncHandler(async (req, res) => {
  const { name, email, role, status, phone, password } = req.body;
  const user = await User.findById(req.params.id).select('+password');
  if (!user) throw new AppError('User not found.', 404);

  user.name = name ?? user.name;
  user.email = email ?? user.email;
  user.role = role ?? user.role;
  user.status = status ?? user.status;
  user.phone = phone ?? user.phone;
  if (password) user.password = password;
  await user.save();
  success(res, { user }, 'User updated');
});

const deleteUser = asyncHandler(async (req, res) => {
  if (String(req.user._id) === req.params.id) {
    throw new AppError('You cannot delete your own account.');
  }
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) throw new AppError('User not found.', 404);
  success(res, {}, 'User deleted');
});

module.exports = { listUsers, createUser, updateUser, deleteUser, userValidators };
