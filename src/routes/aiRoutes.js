const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  chat,
  confirmAction,
  getAuditLogs,
  getSuggestions,
  chatValidators,
  confirmValidators,
} = require('../controllers/aiController');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

// Rate limiter for AI chat requests
const aiChatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: {
    success: false,
    message: 'Too many requests sent to the AI Assistant. Please wait a few moments before trying again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(protect);

router.post('/chat', aiChatLimiter, chatValidators, validate, chat);
router.post('/confirm-action', confirmValidators, validate, confirmAction);
router.get('/audit-logs', getAuditLogs);
router.get('/suggestions', getSuggestions);

module.exports = router;
