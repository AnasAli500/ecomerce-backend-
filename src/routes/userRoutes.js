const express = require('express');
const { listUsers, createUser, updateUser, deleteUser, userValidators } = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();
router.use(protect, authorize('admin'));

router.get('/', listUsers);
router.post('/', userValidators, validate, createUser);
router.put('/:id', userValidators, validate, updateUser);
router.delete('/:id', deleteUser);

module.exports = router;
