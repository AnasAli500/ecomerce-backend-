const { body } = require('express-validator');
const { processChatMessage } = require('../services/aiService');
const { executeConfirmedAction } = require('../services/aiDataService');
const { AiAuditLog } = require('../models');
const { success, paginated } = require('../utils/apiResponse');
const { parsePagination, paginationMeta } = require('../utils/pagination');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

const chatValidators = [
  body('messages').isArray({ min: 1 }).withMessage('Messages array is required'),
  body('messages.*.content').isString().notEmpty().withMessage('Message content is required'),
];

const confirmValidators = [
  body('actionId').notEmpty().withMessage('actionId is required'),
  body('token').notEmpty().withMessage('security token is required'),
];

const chat = asyncHandler(async (req, res) => {
  const { messages } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';

  const result = await processChatMessage({
    messages,
    user: req.user,
    ip,
  });

  success(res, result);
});

const confirmAction = asyncHandler(async (req, res) => {
  const { actionId, token } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';

  const result = await executeConfirmedAction({
    actionId,
    token,
    user: req.user,
    ip,
  });

  success(res, result, 'Action confirmed and executed successfully');
});

const getAuditLogs = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = parsePagination({ ...req.query, sort: req.query.sort || 'createdAt' });
  const filter = {};

  // Staff can only view their own audit logs; Admin can view all
  if (req.user.role !== 'admin') {
    filter.user = req.user._id;
  }

  if (req.query.actionType) {
    filter.actionType = req.query.actionType;
  }

  const [logs, total] = await Promise.all([
    AiAuditLog.find(filter)
      .populate('user', 'name email role')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    AiAuditLog.countDocuments(filter),
  ]);

  paginated(res, logs, paginationMeta(total, page, limit));
});

const getSuggestions = asyncHandler(async (_req, res) => {
  const suggestions = [
    {
      id: 'today-sales',
      labelEn: "Today's Sales",
      labelSo: "Iibka Maanta",
      promptEn: "How much did I sell today?",
      promptSo: "Immisa ayaan iibiyay maanta?",
      category: 'sales',
    },
    {
      id: 'month-profit',
      labelEn: "This Month's Profit",
      labelSo: "Faa'iidada Bishan",
      promptEn: "How much profit did I make this month?",
      promptSo: "Immisa faa'iido ah ayaan bishan sameeyay?",
      category: 'profit',
      adminOnly: true,
    },
    {
      id: 'low-stock',
      labelEn: "Low Stock Products",
      labelSo: "Alaabta Qarka u Saaran inay Dhamaato",
      promptEn: "Which products are running low on stock?",
      promptSo: "Waa kuwee alaabta digniinta ku jirta ee kaydkeedu yaryahay?",
      category: 'inventory',
    },
    {
      id: 'out-stock',
      labelEn: "Out-of-Stock Products",
      labelSo: "Alaabta Dhamatay",
      promptEn: "Which products are completely out of stock?",
      promptSo: "Waa kuwee alaabta dukaanka ka dhamaatay?",
      category: 'inventory',
    },
    {
      id: 'customer-debts',
      labelEn: "Customer Debts",
      labelSo: "Daymaha Macaamiisha",
      promptEn: "Who owes money and what is the total outstanding customer debt?",
      promptSo: "Yaa lacag igu leh immisana waaye wadarta daynta maqan?",
      category: 'debt',
    },
    {
      id: 'today-expenses',
      labelEn: "Today's Expenses",
      labelSo: "Kharashka Maanta",
      promptEn: "What are today's recorded expenses?",
      promptSo: "Waa maxay kharashaadka maanta la qoray?",
      category: 'expenses',
    },
    {
      id: 'best-sellers',
      labelEn: "Best-Selling Products",
      labelSo: "Alaabta ugu Iibka Badan",
      promptEn: "Which products sold the most recently?",
      promptSo: "Waa kuwee alaabta ugu iibka badan ee dukaanka?",
      category: 'sales',
    },
    {
      id: 'stock-movements',
      labelEn: "Stock Movement History",
      labelSo: "Dhaqdhaqaaqa Kaydka",
      promptEn: "Show me recent stock movements this week.",
      promptSo: "I tus dhaqdhaqaaqii kaydka ee ugu dambeeyay.",
      category: 'inventory',
    },
    {
      id: 'weekly-report',
      labelEn: "Weekly Business Report",
      labelSo: "Warbixinta Todobaadka",
      promptEn: "Give me a complete summary report for this week.",
      promptSo: "I sii warbixin kooban oo ku saabsan ganacsiga todobaadkan.",
      category: 'report',
    },
    {
      id: 'how-to-use',
      labelEn: "How to Use This System",
      labelSo: "Sida Nidaamka loo Isticmaalo",
      promptEn: "Explain how to use the JILE Electronics system modules step by step.",
      promptSo: "Sidee loo isticmaalaa nidaamka JILE Electronics talaabo talaabo?",
      category: 'guide',
    },
  ];

  success(res, { suggestions });
});

module.exports = {
  chat,
  confirmAction,
  getAuditLogs,
  getSuggestions,
  chatValidators,
  confirmValidators,
};
