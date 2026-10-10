const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { connectDb } = require('./config/db');
const { Customer } = require('./models');
const apiRoutes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.set('trust proxy', 1);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'API is running' });
});

app.use('/api', apiRoutes);
app.use(notFound);
app.use(errorHandler);

const port = process.env.PORT || 5000;

async function ensureDefaultCustomer() {
  try {
    const walkIn = await Customer.findOne({ isWalkIn: true });
    if (!walkIn) {
      const existing = await Customer.findOne({ name: 'Normal Customer' });
      if (existing) {
        existing.isWalkIn = true;
        if (!existing.phone || existing.phone.trim() === '') existing.phone = '-';
        await existing.save();
      } else {
        await Customer.create({
          name: 'Normal Customer',
          phone: '-',
          isWalkIn: true,
          status: 'active',
        });
      }
    }
  } catch (err) {
    console.error('Failed to ensure default walk-in customer:', err.message);
  }
}

connectDb()
  .then(async () => {
    await ensureDefaultCustomer();
    app.listen(port, () => {
      console.log(`API listening on port ${port}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start server', err);
    process.exit(1);
  });
