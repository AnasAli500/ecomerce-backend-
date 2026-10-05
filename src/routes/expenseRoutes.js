const express = require('express');
const {
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  expenseValidators,
} = require('../controllers/expenseController');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();
router.use(protect);

router.get('/', listExpenses);
router.post('/', expenseValidators, validate, createExpense);
router.put('/:id', expenseValidators, validate, updateExpense);
router.delete('/:id', deleteExpense);

module.exports = router;
