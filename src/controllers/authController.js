const { body } = require('express-validator');
const { User } = require('../models');
const { signToken } = require('../utils/token');
const { success } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

const loginValidators = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Invalid email or password.', 401);
  }
  if (user.status !== 'active') {
    throw new AppError('Account is inactive.', 403);
  }

  const token = signToken(user._id);
  success(res, {
    token,
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  }, 'Logged in');
});

const me = asyncHandler(async (req, res) => {
  success(res, { user: req.user });
});

const logout = asyncHandler(async (_req, res) => {
  success(res, {}, 'Logged out. Discard the token on the client.');
});

module.exports = { login, me, logout, loginValidators };
