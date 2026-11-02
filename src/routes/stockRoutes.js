const express = require('express');
const { listMovements, adjustStock, adjustValidators, addStock, addStockValidators } = require('../controllers/stockController');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();
router.use(protect);

router.get('/', listMovements);
router.post('/adjust', adjustValidators, validate, adjustStock);
router.post('/add', addStockValidators, validate, addStock);

module.exports = router;
