const express = require('express');
const {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  productValidators,
} = require('../controllers/productController');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { upload } = require('../middleware/upload');

const router = express.Router();
router.use(protect);

router.get('/', listProducts);
router.get('/:id', getProduct);
router.post('/', upload.single('image'), productValidators, validate, createProduct);
router.put('/:id', upload.single('image'), updateProduct);
router.delete('/:id', deleteProduct);

module.exports = router;
