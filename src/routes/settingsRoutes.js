const express = require('express');
const { getSettings, updateSettings } = require('../controllers/settingsController');
const { protect, authorize } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const router = express.Router();
router.use(protect);

router.get('/', getSettings);
router.put('/', authorize('admin'), upload.single('storeLogo'), updateSettings);

module.exports = router;
