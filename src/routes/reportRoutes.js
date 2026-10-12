const express = require('express');
const { dashboard, report } = require('../controllers/reportController');
const { getProfit } = require('../controllers/saleController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

router.get('/dashboard', dashboard);
router.get('/profit', authorize('admin'), getProfit);
router.get('/', report);

module.exports = router;
