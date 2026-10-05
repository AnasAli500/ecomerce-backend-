const { Counter } = require('../models');

async function nextNumber(name, prefix) {
  const counter = await Counter.findOneAndUpdate(
    { name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `${prefix}-${String(counter.seq).padStart(4, '0')}`;
}

module.exports = { nextNumber };
