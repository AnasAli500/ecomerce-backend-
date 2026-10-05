const { Settings } = require('../models');
const { success } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

const getSettings = asyncHandler(async (_req, res) => {
  let settings = await Settings.findOne();
  if (!settings) settings = await Settings.create({});
  success(res, { settings });
});

const updateSettings = asyncHandler(async (req, res) => {
  let settings = await Settings.findOne();
  if (!settings) settings = await Settings.create({});
  const fields = ['storeName', 'phone', 'email', 'address', 'currency'];
  fields.forEach((field) => {
    if (req.body[field] !== undefined) settings[field] = req.body[field];
  });
  if (req.file) settings.storeLogo = `/uploads/${req.file.filename}`;
  await settings.save();
  success(res, { settings }, 'Settings saved');
});

module.exports = { getSettings, updateSettings };
