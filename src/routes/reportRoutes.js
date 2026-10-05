const express = require('express');
const { dashboard, report } = require('../controllers/reportController');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

router.get('/dashboard', dashboard);
router.get('/', report);

module.exports = router;
