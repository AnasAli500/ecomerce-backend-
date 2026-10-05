const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { login, me, logout, loginValidators } = require('../controllers/authController');
const { validate } = require('../middleware/validate');
const { protect } = require('../middleware/auth');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                  // max 20 attempts per window
  message: { success: false, message: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginLimiter, loginValidators, validate, login);
router.get('/me', protect, me);
router.post('/logout', protect, logout);
router.post('/refresh-check', protect, (req, res) => {
  res.json({ success: true, data: { valid: true } });
});

module.exports = router;
