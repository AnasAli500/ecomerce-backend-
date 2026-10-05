const express = require('express');
const {
  listSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  supplierValidators,
} = require('../controllers/supplierController');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();
router.use(protect);

router.get('/', listSuppliers);
router.get('/:id', getSupplier);
router.post('/', supplierValidators, validate, createSupplier);
router.put('/:id', supplierValidators, validate, updateSupplier);
router.delete('/:id', deleteSupplier);

module.exports = router;
