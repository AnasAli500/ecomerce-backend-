const express = require('express');
const {
  listCustomerPayments,
  createCustomerPayment,
  listSupplierPayments,
  createSupplierPayment,
  customerPaymentValidators,
  supplierPaymentValidators,
} = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();
router.use(protect);

router.get('/customers', listCustomerPayments);
router.post('/customers', customerPaymentValidators, validate, createCustomerPayment);
router.get('/suppliers', listSupplierPayments);
router.post('/suppliers', supplierPaymentValidators, validate, createSupplierPayment);

module.exports = router;
