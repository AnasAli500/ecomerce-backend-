const express = require('express');
const {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  customerValidators,
} = require('../controllers/customerController');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();
router.use(protect);

router.get('/', listCustomers);
router.get('/:id', getCustomer);
router.post('/', customerValidators, validate, createCustomer);
router.put('/:id', customerValidators, validate, updateCustomer);
router.delete('/:id', deleteCustomer);

module.exports = router;
