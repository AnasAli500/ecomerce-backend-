const express = require('express');
const {
  listPurchases,
  getPurchase,
  createPurchase,
  purchaseValidators,
} = require('../controllers/purchaseController');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();
router.use(protect);

router.get('/', listPurchases);
router.get('/:id', getPurchase);
router.post('/', purchaseValidators, validate, createPurchase);

module.exports = router;
