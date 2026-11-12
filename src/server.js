const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config();

const { connectDb } = require('./config/db');
const { Customer } = require('./models');
const apiRoutes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.set('trust proxy', 1);

// Secure HTTP headers with cross-origin resource policy for uploads
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS Configuration
const defaultOrigins = [
  'https://ecomerce-frorntend.vercel.app',
  'https://ecomerce-frontend.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
];

const envOrigins = (process.env.CLIENT_URL || process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((url) => url.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. mobile apps, curl, Railway health checks)
    if (!origin) return callback(null, true);

    const cleanOrigin = origin.replace(/\/+$/, '');

    // Allow exact matches or Vercel preview URLs
    const isAllowed =
      allowedOrigins.includes(cleanOrigin) ||
      /^https:\/\/ecomerce-[a-zA-Z0-9_-]+\.vercel\.app$/.test(cleanOrigin);

    if (isAllowed || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }

    console.warn(`[CORS] Request blocked from origin: ${origin}`);
    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(morgan('dev'));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Root & Health routes for Railway and status monitoring
app.get('/', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'amal-electronics-api',
    health: '/health',
    apiHealth: '/api/health',
  });
});

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    success: true,
    service: 'amal-electronics-api',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    success: true,
    message: 'API is running',
    build: 'ai-routes-v2',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    ai: { chat: '/api/ai/chat', assistant: '/api/assistant' },
  });
});

function mountAiRoutes() {
  const aiRoutes = require('./routes/aiRoutes');
  const assistantRoutes = require('./routes/assistant');

  // Direct mounts so these never depend on routes/index.js
  app.use('/api/ai', aiRoutes);
  app.use('/api/assistant', assistantRoutes);
  // Tolerate clients that already include /api in the base URL
  app.use('/api/api/ai', aiRoutes);
  app.use('/api/api/assistant', assistantRoutes);
  console.log('[boot] AI routes mounted: /api/ai/chat, /api/assistant');
}

try {
  mountAiRoutes();
} catch (err) {
  console.error('[boot] Failed to mount AI routes', err);
}

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

if (require.main === module) {
  connectDb()
    .then(async () => {
      await ensureDefaultCustomer();
      app.listen(port, '0.0.0.0', () => {
        console.log(`API listening on port ${port} (0.0.0.0)`);
      });
    })
    .catch((err) => {
      console.error('Failed to start server:', err);
      process.exit(1);
    });
}

module.exports = { app, ensureDefaultCustomer };
