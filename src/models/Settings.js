const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    storeName: { type: String, default: 'Amal Electronics' },
    storeLogo: { type: String, default: '' },
    phone: { type: String, default: '+252 61 000 0000' },
    email: { type: String, default: 'hello@amalelectronics.com' },
    address: { type: String, default: 'Mogadishu, Somalia' },
    currency: { type: String, default: 'USD' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settings', settingsSchema);
