const express = require('express');
const {
  listSales,
  getSale,
  createSale,
  updateSale,
  deleteSale,
  getProfit,
  saleValidators,
} = require('../controllers/saleController');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();
router.use(protect);

router.get('/profit', authorize('admin'), getProfit);
router.get('/', listSales);
router.get('/:id', getSale);
router.post('/', saleValidators, validate, createSale);
router.put('/:id', saleValidators, validate, updateSale);
router.delete('/:id', deleteSale);

module.exports = router;
