const express = require('express');
const {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  categoryValidators,
} = require('../controllers/categoryController');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();
router.use(protect);

router.get('/', listCategories);
router.post('/', categoryValidators, validate, createCategory);
router.put('/:id', categoryValidators, validate, updateCategory);
router.delete('/:id', deleteCategory);

module.exports = router;
