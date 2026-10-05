const express = require('express');
const { listSales, getSale, createSale, updateSale, deleteSale, saleValidators } = require('../controllers/saleController');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();
router.use(protect);

router.get('/', listSales);
router.get('/:id', getSale);
router.post('/', saleValidators, validate, createSale);
router.put('/:id', saleValidators, validate, updateSale);
router.delete('/:id', deleteSale);

module.exports = router;
