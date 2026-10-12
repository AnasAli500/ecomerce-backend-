const crypto = require('crypto');
const {
  Sale,
  SaleItem,
  Purchase,
  PurchaseItem,
  Expense,
  Product,
  Category,
  Customer,
  Supplier,
  StockMovement,
  CustomerPayment,
  SupplierPayment,
  AiAuditLog,
} = require('../models');
const {
  startOfDay,
  endOfDay,
  startOfWeek,
  startOfMonth,
  startOfYear,
  resolvePeriod,
} = require('../utils/dateRange');
const { roundMoney, paymentStatus } = require('../utils/money');
const { calculateSalesProfit } = require('../utils/profit');
const { applyStockChange } = require('./stockService');
const { nextNumber } = require('../utils/invoice');
const AppError = require('../utils/AppError');

// In-memory staged action cache with 30-minute expiration
const stagedActions = new Map();

function cleanExpiredActions() {
  const now = Date.now();
  for (const [id, item] of stagedActions.entries()) {
    if (item.expiresAt < now) {
      stagedActions.delete(id);
    }
  }
}
setInterval(cleanExpiredActions, 5 * 60 * 1000);

function parseDateRange(period, customFrom, customTo) {
  const now = new Date();

  if (customFrom && customTo) {
    return {
      from: startOfDay(new Date(customFrom)),
      to: endOfDay(new Date(customTo)),
      label: `${customFrom} to ${customTo}`,
    };
  }

  const p = String(period || 'today').toLowerCase().trim();

  if (p === 'today' || p === 'maanta') {
    return { from: startOfDay(now), to: endOfDay(now), label: 'Today' };
  }
  if (p === 'yesterday' || p === 'shalay') {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return { from: startOfDay(y), to: endOfDay(y), label: 'Yesterday' };
  }
  if (p === 'this_week' || p === 'week' || p === 'todobaadkan') {
    return { from: startOfWeek(now), to: endOfDay(now), label: 'This Week' };
  }
  if (p === 'last_week' || p === 'todobaadkii_hore') {
    const end = new Date(startOfWeek(now).getTime() - 1);
    const start = startOfWeek(end);
    return { from: start, to: end, label: 'Last Week' };
  }
  if (p === 'this_month' || p === 'month' || p === 'bishan') {
    return { from: startOfMonth(now), to: endOfDay(now), label: 'This Month' };
  }
  if (p === 'last_month' || p === 'bishii_hore') {
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
    return { from: startOfMonth(prevMonth), to: end, label: 'Last Month' };
  }
  if (p === 'this_year' || p === 'year' || p === 'sanadkan') {
    return { from: startOfYear(now), to: endOfDay(now), label: 'This Year' };
  }

  // Fallback to today
  return { from: startOfDay(now), to: endOfDay(now), label: 'Today' };
}

/**
 * 1. Sales Metrics
 */
async function getSalesMetrics({ period = 'today', from, to }) {
  const range = parseDateRange(period, from, to);
  const filter = { date: { $gte: range.from, $lte: range.to } };

  const sales = await Sale.find(filter)
    .populate('customer', 'name phone')
    .sort({ date: -1 });

  const totalRevenue = roundMoney(sales.reduce((sum, s) => sum + s.total, 0));
  const totalPaid = roundMoney(sales.reduce((sum, s) => sum + s.paid, 0));
  const totalDebt = roundMoney(sales.reduce((sum, s) => sum + s.debt, 0));
  const totalDiscount = roundMoney(sales.reduce((sum, s) => sum + s.discount, 0));

  // Aggregate items sold in this period
  const saleIds = sales.map((s) => s._id);
  const saleItems = await SaleItem.find({ sale: { $in: saleIds } });

  const productAgg = {};
  for (const item of saleItems) {
    const key = item.productName || 'Unknown';
    if (!productAgg[key]) {
      productAgg[key] = { productName: key, sku: item.sku, quantity: 0, revenue: 0 };
    }
    productAgg[key].quantity += item.quantity;
    productAgg[key].revenue = roundMoney(productAgg[key].revenue + item.lineTotal);
  }

  const topProducts = Object.values(productAgg)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  return {
    period: range.label,
    from: range.from,
    to: range.to,
    salesCount: sales.length,
    totalRevenue,
    totalPaid,
    totalDebt,
    totalDiscount,
    topProducts,
    recentInvoices: sales.slice(0, 5).map((s) => ({
      invoiceNumber: s.invoiceNumber,
      customer: s.customer?.name || 'Normal Customer',
      total: s.total,
      paid: s.paid,
      debt: s.debt,
      paymentStatus: s.paymentStatus,
      date: s.date,
    })),
  };
}

/**
 * 2. Profit Metrics (Admin Only)
 */
async function getProfitMetrics({ period = 'today', from, to, userRole }) {
  if (userRole !== 'admin') {
    return {
      authorized: false,
      error: 'Permission Denied: Only Admin users can view profit reports.',
      errorSo: 'Kuma lihid ogolaansho inaad aragto faa\'iidada. Kaliya maamulaha (Admin) ayaa arki kara.',
    };
  }

  const range = parseDateRange(period, from, to);
  const dateFilter = { $gte: range.from, $lte: range.to };

  const [sales, expenses] = await Promise.all([
    Sale.find({ date: dateFilter })
      .populate('customer', 'name')
      .populate({
        path: 'items',
        populate: {
          path: 'product',
          select: 'name costPrice purchasePrice category',
        },
      }),
    Expense.find({ date: dateFilter }),
  ]);

  // Ensure items are populated for all sales
  for (const sale of sales) {
    if (!sale.items || sale.items.length === 0) {
      sale.items = await SaleItem.find({ sale: sale._id }).populate({
        path: 'product',
        select: 'name costPrice purchasePrice category',
      });
    }
  }

  const profitResult = calculateSalesProfit(sales);
  const totalRevenue = profitResult.summary.totalRevenue;
  const totalCostOfGoods = profitResult.summary.totalCost;
  const grossProfit = profitResult.summary.totalProfit;

  const totalExpenses = roundMoney(expenses.reduce((sum, e) => sum + e.amount, 0));
  const netProfit = roundMoney(grossProfit - totalExpenses);

  const profitMarginPercent = totalRevenue > 0 ? roundMoney((grossProfit / totalRevenue) * 100) : 0;
  const netProfitMarginPercent = totalRevenue > 0 ? roundMoney((netProfit / totalRevenue) * 100) : 0;

  return {
    authorized: true,
    period: range.label,
    from: range.from,
    to: range.to,
    salesCount: sales.length,
    totalRevenue,
    costOfGoodsSold: totalCostOfGoods,
    grossProfit,
    totalExpenses,
    netProfit,
    profitMarginPercent,
    netProfitMarginPercent,
  };
}

/**
 * 3. Inventory Status
 */
async function getInventoryStatus({ filter = 'all', limit = 15, search }) {
  const query = { isDeleted: false };

  if (search) {
    query.$or = [
      { name: new RegExp(search, 'i') },
      { sku: new RegExp(search, 'i') },
    ];
  }

  if (filter === 'low_stock' || filter === 'low') {
    query.$expr = { $and: [{ $lte: ['$currentStock', '$minStock'] }, { $gt: ['$currentStock', 0] }] };
  } else if (filter === 'out_of_stock' || filter === 'out') {
    query.currentStock = { $lte: 0 };
  }

  const [products, allActive] = await Promise.all([
    Product.find(query).populate('category', 'name').limit(limit),
    Product.find({ isDeleted: false }),
  ]);

  const totalInventoryValue = roundMoney(
    allActive.reduce((sum, p) => sum + (p.currentStock * (p.purchasePrice || p.costPrice || 0)), 0)
  );

  const lowStockCount = allActive.filter((p) => p.currentStock > 0 && p.currentStock <= p.minStock).length;
  const outOfStockCount = allActive.filter((p) => p.currentStock <= 0).length;

  return {
    totalProducts: allActive.length,
    lowStockCount,
    outOfStockCount,
    totalInventoryValue,
    displayedCount: products.length,
    products: products.map((p) => ({
      id: p._id,
      name: p.name,
      sku: p.sku,
      category: p.category?.name || 'Uncategorized',
      currentStock: p.currentStock,
      minStock: p.minStock,
      sellingPrice: p.sellingPrice,
      purchasePrice: p.purchasePrice,
      status: p.currentStock <= 0 ? 'Out of Stock' : p.currentStock <= p.minStock ? 'Low Stock' : 'In Stock',
    })),
  };
}

/**
 * 4. Stock Movements
 */
async function getStockMovements({ period = 'today', type, productId, limit = 10 }) {
  const range = parseDateRange(period);
  const filter = { date: { $gte: range.from, $lte: range.to } };

  if (type && type !== 'all') {
    filter.type = type;
  }
  if (productId) {
    filter.product = productId;
  }

  const movements = await StockMovement.find(filter)
    .populate('product', 'name sku')
    .populate('createdBy', 'name')
    .sort({ date: -1 })
    .limit(limit);

  return {
    period: range.label,
    count: movements.length,
    movements: movements.map((m) => ({
      date: m.date,
      productName: m.product?.name || 'Unknown',
      sku: m.product?.sku || '-',
      type: m.type,
      quantity: m.quantity,
      previousStock: m.previousStock,
      newStock: m.newStock,
      reason: m.reason,
      referenceNumber: m.referenceNumber || '-',
      notes: m.notes || '',
      user: m.createdBy?.name || 'System',
    })),
  };
}

/**
 * 5. Customer Debts & Balances
 */
async function getCustomerDebts({ customerId, search, limit = 10 }) {
  const filter = { totalDebt: { $gt: 0 } };

  if (customerId) {
    filter._id = customerId;
  } else if (search) {
    filter.$or = [
      { name: new RegExp(search, 'i') },
      { phone: new RegExp(search, 'i') },
    ];
  }

  const debtors = await Customer.find(filter).sort({ totalDebt: -1 }).limit(limit);
  const allDebtors = await Customer.find({ totalDebt: { $gt: 0 } });
  const totalOutstandingDebt = roundMoney(allDebtors.reduce((sum, c) => sum + c.totalDebt, 0));

  return {
    totalDebtorsCount: allDebtors.length,
    totalOutstandingDebt,
    debtors: debtors.map((c) => ({
      id: c._id,
      name: c.name,
      phone: c.phone || 'No Phone',
      totalDebt: c.totalDebt,
      totalPurchases: c.totalPurchases,
      totalPaid: c.totalPaid,
      debtStatus: c.debtStatus,
    })),
  };
}

/**
 * 6. Expenses Summary
 */
async function getExpensesSummary({ period = 'today', from, to, category }) {
  const range = parseDateRange(period, from, to);
  const filter = { date: { $gte: range.from, $lte: range.to } };

  if (category) {
    filter.category = category;
  }

  const expenses = await Expense.find(filter)
    .populate('createdBy', 'name')
    .sort({ date: -1 });

  const totalAmount = roundMoney(expenses.reduce((sum, e) => sum + e.amount, 0));

  const byCategory = {};
  for (const exp of expenses) {
    byCategory[exp.category] = roundMoney((byCategory[exp.category] || 0) + exp.amount);
  }

  return {
    period: range.label,
    totalAmount,
    expensesCount: expenses.length,
    breakdownByCategory: byCategory,
    recentExpenses: expenses.slice(0, 10).map((e) => ({
      id: e._id,
      name: e.name,
      category: e.category,
      amount: e.amount,
      date: e.date,
      createdBy: e.createdBy?.name || 'Staff',
      description: e.description || '',
    })),
  };
}

/**
 * 7. Suppliers Summary
 */
async function getSuppliersSummary({ supplierId, search, limit = 10 }) {
  const filter = {};
  if (supplierId) filter._id = supplierId;
  if (search) {
    filter.$or = [
      { name: new RegExp(search, 'i') },
      { company: new RegExp(search, 'i') },
    ];
  }

  const suppliers = await Supplier.find(filter).sort({ amountDue: -1 }).limit(limit);
  const allSuppliers = await Supplier.find();
  const totalAmountDue = roundMoney(allSuppliers.reduce((sum, s) => sum + s.amountDue, 0));

  return {
    totalSuppliers: allSuppliers.length,
    totalAmountDueToSuppliers: totalAmountDue,
    suppliers: suppliers.map((s) => ({
      id: s._id,
      name: s.name,
      company: s.company || '-',
      phone: s.phone || '-',
      totalPurchases: s.totalPurchases,
      amountPaid: s.amountPaid,
      amountDue: s.amountDue,
    })),
  };
}

/**
 * 8. Comprehensive Business Overview
 */
async function getBusinessOverview({ userRole }) {
  const todayRange = parseDateRange('today');
  const [
    products,
    customers,
    suppliers,
    todaySales,
    todayExpenses,
    debtors,
    lowStock,
  ] = await Promise.all([
    Product.find({ isDeleted: false }),
    Customer.find(),
    Supplier.find(),
    Sale.find({ date: { $gte: todayRange.from, $lte: todayRange.to } }),
    Expense.find({ date: { $gte: todayRange.from, $lte: todayRange.to } }),
    Customer.find({ totalDebt: { $gt: 0 } }),
    Product.find({ isDeleted: false, $expr: { $lte: ['$currentStock', '$minStock'] } }),
  ]);

  const todayRevenue = roundMoney(todaySales.reduce((sum, s) => sum + s.total, 0));
  const todayExpenseTotal = roundMoney(todayExpenses.reduce((sum, e) => sum + e.amount, 0));
  const totalCustomerDebt = roundMoney(debtors.reduce((sum, c) => sum + c.totalDebt, 0));
  const totalSupplierDebt = roundMoney(suppliers.reduce((sum, s) => sum + s.amountDue, 0));
  const inventoryValuation = roundMoney(
    products.reduce((sum, p) => sum + p.currentStock * (p.purchasePrice || p.costPrice || 0), 0)
  );

  return {
    todaySalesCount: todaySales.length,
    todayRevenue,
    todayExpenses: todayExpenseTotal,
    totalProductsCount: products.length,
    totalCustomersCount: customers.length,
    totalSuppliersCount: suppliers.length,
    totalCustomerDebt,
    totalSupplierDebt,
    inventoryValuation,
    lowStockAlertCount: lowStock.length,
    canViewProfits: userRole === 'admin',
  };
}

// ==========================================
// ACTION PREPARATION (Preview & Staging)
// ==========================================

function createActionPreview(actionType, titleEn, titleSo, summaryEn, summarySo, details, parameters, requiresAdmin = false) {
  const actionId = crypto.randomUUID();
  const token = crypto.randomBytes(16).toString('hex');
  const preview = {
    actionId,
    token,
    actionType,
    titleEn,
    titleSo,
    summaryEn,
    summarySo,
    details,
    parameters,
    requiresAdmin,
    createdAt: Date.now(),
    expiresAt: Date.now() + 30 * 60 * 1000,
  };
  stagedActions.set(actionId, preview);
  return preview;
}

/**
 * Stage Add Product
 */
async function prepareAddProduct(params, user) {
  const { name, sku, category: catInput, sellingPrice, purchasePrice, minStock = 5, initialStock = 0, description = '' } = params;

  if (!name || !sku || !sellingPrice || !purchasePrice) {
    throw new AppError('Product name, SKU, selling price, and purchase price are required.');
  }

  // Check SKU uniqueness
  const existingSku = await Product.findOne({ sku: String(sku).toUpperCase().trim() });
  if (existingSku) {
    throw new AppError(`Product with SKU "${sku}" already exists (${existingSku.name}).`);
  }

  // Resolve Category
  let categoryDoc;
  if (catInput) {
    categoryDoc = await Category.findOne({
      $or: [{ _id: catInput.match(/^[0-9a-fA-F]{24}$/) ? catInput : null }, { name: new RegExp(catInput.trim(), 'i') }],
    });
  }
  if (!categoryDoc) {
    categoryDoc = await Category.findOne(); // Fallback to first available category
    if (!categoryDoc) {
      categoryDoc = await Category.create({ name: 'General', description: 'General Electronics' });
    }
  }

  const details = {
    productName: name,
    sku: String(sku).toUpperCase().trim(),
    category: categoryDoc.name,
    sellingPrice: Number(sellingPrice),
    purchasePrice: Number(purchasePrice),
    minStock: Number(minStock),
    initialStock: Number(initialStock),
    description,
  };

  return createActionPreview(
    'create_product',
    'Add New Product',
    'Ku dar Alaab Cusub',
    `Create product "${name}" (SKU: ${details.sku}) at \$${details.sellingPrice}`,
    `Diiwaangeli alaabta "${name}" (SKU: ${details.sku}) qiimaha iibka \$${details.sellingPrice}`,
    details,
    {
      name,
      sku: details.sku,
      category: categoryDoc._id.toString(),
      categoryName: categoryDoc.name,
      sellingPrice: details.sellingPrice,
      purchasePrice: details.purchasePrice,
      minStock: details.minStock,
      initialStock: details.initialStock,
      description,
    },
    false
  );
}

/**
 * Stage Stock Adjustment
 */
async function prepareAdjustStock(params, user) {
  const { product: prodInput, quantity, type, reason = 'damaged', notes = '' } = params;
  const qty = Number(quantity);

  if (!qty || qty <= 0) {
    throw new AppError('Quantity must be greater than 0.');
  }
  if (!['in', 'out'].includes(type)) {
    throw new AppError('Adjustment type must be "in" or "out".');
  }

  // Find product
  let product;
  if (typeof prodInput === 'string' && prodInput.match(/^[0-9a-fA-F]{24}$/)) {
    product = await Product.findById(prodInput);
  } else {
    product = await Product.findOne({
      isDeleted: false,
      $or: [
        { name: new RegExp(prodInput.trim(), 'i') },
        { sku: new RegExp(prodInput.trim(), 'i') },
      ],
    });
  }

  if (!product || product.isDeleted) {
    throw new AppError(`Product "${prodInput}" not found in system.`);
  }

  const previousStock = product.currentStock;
  const newStock = type === 'in' ? previousStock + qty : previousStock - qty;

  if (newStock < 0) {
    throw new AppError(`Cannot deduct ${qty} units. Current stock for "${product.name}" is only ${previousStock}.`);
  }

  const validReasons = ['adjustment_in', 'adjustment_out', 'damaged', 'lost'];
  const finalReason = validReasons.includes(reason) ? reason : type === 'in' ? 'adjustment_in' : 'adjustment_out';

  const details = {
    productName: product.name,
    sku: product.sku,
    currentStock: previousStock,
    adjustmentType: type === 'in' ? 'Stock Increase (+)' : 'Stock Deduction (-)',
    quantity: qty,
    projectedStock: newStock,
    reason: finalReason,
    notes: notes || `AI-assisted adjustment: ${finalReason}`,
  };

  return createActionPreview(
    'adjust_stock',
    'Stock Adjustment',
    'Hagaajinta Kaydka',
    `Adjust ${type.toUpperCase()} ${qty} units of "${product.name}" (Reason: ${finalReason})`,
    `${type === 'in' ? 'Ku dar' : 'Ka jar'} ${qty} xabbo oo ah "${product.name}" (Sababta: ${finalReason})`,
    details,
    {
      productId: product._id.toString(),
      productName: product.name,
      quantity: qty,
      type,
      reason: finalReason,
      notes: details.notes,
    },
    false
  );
}

/**
 * Stage Customer Payment
 */
async function prepareCustomerPayment(params, user) {
  const { customer: custInput, amount, method = 'cash', notes = '' } = params;
  const payAmount = roundMoney(Number(amount));

  if (!payAmount || payAmount <= 0) {
    throw new AppError('Payment amount must be greater than 0.');
  }

  let customer;
  if (typeof custInput === 'string' && custInput.match(/^[0-9a-fA-F]{24}$/)) {
    customer = await Customer.findById(custInput);
  } else {
    customer = await Customer.findOne({
      $or: [
        { name: new RegExp(custInput.trim(), 'i') },
        { phone: new RegExp(custInput.trim(), 'i') },
      ],
    });
  }

  if (!customer) {
    throw new AppError(`Customer "${custInput}" not found in system.`);
  }

  if (customer.totalDebt <= 0) {
    throw new AppError(`Customer "${customer.name}" has no outstanding debt ($0.00).`);
  }

  if (payAmount > customer.totalDebt) {
    throw new AppError(`Payment amount (\$${payAmount}) cannot exceed remaining debt (\$${customer.totalDebt}) for "${customer.name}".`);
  }

  const remainingDebt = roundMoney(customer.totalDebt - payAmount);

  const details = {
    customerName: customer.name,
    phone: customer.phone || '-',
    currentDebt: customer.totalDebt,
    amountPaying: payAmount,
    projectedRemainingDebt: remainingDebt,
    method,
    notes: notes || 'AI-assisted customer payment registration',
  };

  return createActionPreview(
    'record_customer_payment',
    'Record Customer Payment',
    'Diiwaangeli Lacag-bixinta Macaamiilka',
    `Record \$${payAmount} debt repayment from "${customer.name}"`,
    `Diiwaangeli bixinta daynta ee \$${payAmount} ee uu bixinayo "${customer.name}"`,
    details,
    {
      customerId: customer._id.toString(),
      customerName: customer.name,
      amount: payAmount,
      method,
      notes: details.notes,
    },
    false
  );
}

/**
 * Stage Record Expense
 */
async function prepareExpense(params, user) {
  const { name, category, amount, description = '', date } = params;
  const expAmount = roundMoney(Number(amount));

  if (!name || !expAmount || expAmount <= 0) {
    throw new AppError('Expense name and valid amount (> 0) are required.');
  }

  const validCategories = ['Rent', 'Electricity', 'Transport', 'Salary', 'Internet', 'Other'];
  const matchedCategory = validCategories.find((c) => c.toLowerCase() === String(category || '').toLowerCase()) || 'Other';
  const expDate = date ? new Date(date) : new Date();

  const details = {
    expenseName: name,
    category: matchedCategory,
    amount: expAmount,
    date: expDate.toISOString().split('T')[0],
    description,
  };

  return createActionPreview(
    'record_expense',
    'Record Business Expense',
    'Diiwaangeli Kharash Ganacsi',
    `Record \$${expAmount} expense for "${name}" under category ${matchedCategory}`,
    `Diiwaangeli kharashka \$${expAmount} ee "${name}" qaybta ${matchedCategory}`,
    details,
    {
      name,
      category: matchedCategory,
      amount: expAmount,
      date: expDate,
      description,
    },
    false
  );
}

/**
 * Stage Update Product Price or MinStock
 */
async function prepareUpdateProduct(params, user) {
  const { product: prodInput, sellingPrice, purchasePrice, minStock, name } = params;

  let product;
  if (typeof prodInput === 'string' && prodInput.match(/^[0-9a-fA-F]{24}$/)) {
    product = await Product.findById(prodInput);
  } else {
    product = await Product.findOne({
      isDeleted: false,
      $or: [
        { name: new RegExp(prodInput.trim(), 'i') },
        { sku: new RegExp(prodInput.trim(), 'i') },
      ],
    });
  }

  if (!product || product.isDeleted) {
    throw new AppError(`Product "${prodInput}" not found in system.`);
  }

  const updates = {};
  const details = {
    productName: product.name,
    sku: product.sku,
    currentSellingPrice: product.sellingPrice,
    currentPurchasePrice: product.purchasePrice,
    currentMinStock: product.minStock,
  };

  if (sellingPrice !== undefined) {
    updates.sellingPrice = roundMoney(Number(sellingPrice));
    details.newSellingPrice = updates.sellingPrice;
  }
  if (purchasePrice !== undefined) {
    updates.purchasePrice = roundMoney(Number(purchasePrice));
    updates.costPrice = updates.purchasePrice;
    details.newPurchasePrice = updates.purchasePrice;
  }
  if (minStock !== undefined) {
    updates.minStock = Number(minStock);
    details.newMinStock = updates.minStock;
  }
  if (name) {
    updates.name = name.trim();
    details.newName = updates.name;
  }

  return createActionPreview(
    'update_product',
    'Update Product Information',
    'Cusboonaysii Xogta Alaabta',
    `Update parameters for "${product.name}" (SKU: ${product.sku})`,
    `Cusboonaysii qiimaha/faahfaahinta "${product.name}" (SKU: ${product.sku})`,
    details,
    {
      productId: product._id.toString(),
      updates,
    },
    false
  );
}

/**
 * Stage Record Purchase
 */
async function preparePurchase(params, user) {
  const { supplier: suppInput, items, paid = 0, notes = '' } = params;

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new AppError('At least one item is required for a purchase order.');
  }

  let supplier;
  if (typeof suppInput === 'string' && suppInput.match(/^[0-9a-fA-F]{24}$/)) {
    supplier = await Supplier.findById(suppInput);
  } else {
    supplier = await Supplier.findOne({
      $or: [
        { name: new RegExp(suppInput.trim(), 'i') },
        { company: new RegExp(suppInput.trim(), 'i') },
      ],
    });
  }

  if (!supplier) {
    throw new AppError(`Supplier "${suppInput}" not found.`);
  }

  let calculatedTotal = 0;
  const preparedItems = [];

  for (const item of items) {
    let prod;
    if (typeof item.product === 'string' && item.product.match(/^[0-9a-fA-F]{24}$/)) {
      prod = await Product.findById(item.product);
    } else {
      prod = await Product.findOne({
        isDeleted: false,
        $or: [
          { name: new RegExp(item.product.trim(), 'i') },
          { sku: new RegExp(item.product.trim(), 'i') },
        ],
      });
    }

    if (!prod || prod.isDeleted) {
      throw new AppError(`Product "${item.product}" not found.`);
    }

    const qty = Number(item.quantity);
    const unitPrice = roundMoney(Number(item.purchasePrice || prod.purchasePrice));
    const lineTotal = roundMoney(qty * unitPrice);
    calculatedTotal += lineTotal;

    preparedItems.push({
      productId: prod._id.toString(),
      productName: prod.name,
      sku: prod.sku,
      quantity: qty,
      purchasePrice: unitPrice,
      lineTotal,
    });
  }

  calculatedTotal = roundMoney(calculatedTotal);
  const paidAmount = roundMoney(Math.min(Number(paid) || 0, calculatedTotal));
  const remainingDue = roundMoney(calculatedTotal - paidAmount);

  const details = {
    supplierName: supplier.name,
    company: supplier.company || '-',
    items: preparedItems,
    total: calculatedTotal,
    paid: paidAmount,
    amountRemainingDue: remainingDue,
    notes,
  };

  return createActionPreview(
    'record_purchase',
    'Record Inventory Purchase',
    'Diiwaangeli Soo Iibsiga Alaabta',
    `Purchase order from "${supplier.name}" for \$${calculatedTotal}`,
    `Dalabka soo iibsiga ee "${supplier.name}" oo wadarkiisu yahay \$${calculatedTotal}`,
    details,
    {
      supplierId: supplier._id.toString(),
      items: preparedItems,
      total: calculatedTotal,
      paid: paidAmount,
      remaining: remainingDue,
      notes,
    },
    false
  );
}

// ==========================================
// EXECUTE CONFIRMED ACTION (User clicked Approve)
// ==========================================

async function executeConfirmedAction({ actionId, token, user, ip = '' }) {
  const staged = stagedActions.get(actionId);

  if (!staged) {
    throw new AppError('Action request expired or not found. Please ask the AI Assistant again.', 404);
  }

  if (staged.token !== token) {
    throw new AppError('Invalid security token for this action confirmation.', 403);
  }

  if (staged.expiresAt < Date.now()) {
    stagedActions.delete(actionId);
    throw new AppError('This action proposal has expired. Please stage it again.', 410);
  }

  if (staged.requiresAdmin && user.role !== 'admin') {
    throw new AppError('Permission Denied: Only Admin users can approve this action.', 403);
  }

  const { actionType, parameters, summaryEn } = staged;
  let executionResult = null;

  try {
    switch (actionType) {
      case 'create_product': {
        const productPayload = {
          name: parameters.name,
          sku: parameters.sku,
          category: parameters.category,
          sellingPrice: parameters.sellingPrice,
          purchasePrice: parameters.purchasePrice,
          costPrice: parameters.purchasePrice,
          minStock: parameters.minStock,
          description: parameters.description || '',
          currentStock: 0,
        };

        const product = await Product.create(productPayload);

        if (parameters.initialStock > 0) {
          await applyStockChange({
            productId: product._id,
            quantity: parameters.initialStock,
            type: 'in',
            reason: 'new_product',
            referenceType: 'product',
            referenceId: product._id,
            referenceNumber: product.sku,
            notes: 'Initial stock via AI assistant',
            createdBy: user._id,
          });
        }

        const fresh = await Product.findById(product._id).populate('category');
        executionResult = {
          success: true,
          productId: fresh._id,
          productName: fresh.name,
          sku: fresh.sku,
          currentStock: fresh.currentStock,
          sellingPrice: fresh.sellingPrice,
          messageEn: `Product "${fresh.name}" (SKU: ${fresh.sku}) was successfully created!`,
          messageSo: `Alaabta "${fresh.name}" (SKU: ${fresh.sku}) si guul leh ayaa loo diiwaangeliyay!`,
        };
        break;
      }

      case 'adjust_stock': {
        const result = await applyStockChange({
          productId: parameters.productId,
          quantity: parameters.quantity,
          type: parameters.type,
          reason: parameters.reason,
          referenceType: 'adjustment',
          referenceNumber: 'AI-ADJ',
          notes: parameters.notes || 'AI-assisted adjustment',
          createdBy: user._id,
        });

        executionResult = {
          success: true,
          productId: result.product._id,
          productName: result.product.name,
          newStock: result.product.currentStock,
          previousStock: result.movement.previousStock,
          quantity: result.movement.quantity,
          type: result.movement.type,
          reason: result.movement.reason,
          messageEn: `Stock for "${result.product.name}" updated successfully to ${result.product.currentStock} units!`,
          messageSo: `Kaydka alaabta "${result.product.name}" si guul leh ayaa loogu beddelay ${result.product.currentStock} xabbo!`,
        };
        break;
      }

      case 'record_customer_payment': {
        const customer = await Customer.findById(parameters.customerId);
        if (!customer) throw new AppError('Customer not found.', 404);
        if (customer.totalDebt <= 0) throw new AppError('Customer has no outstanding debt.');

        const amount = roundMoney(Number(parameters.amount));
        if (amount > customer.totalDebt) {
          throw new AppError(`Payment cannot exceed debt of ${customer.totalDebt}.`);
        }

        const previousDebt = customer.totalDebt;
        let remainingToApply = amount;
        const allocations = [];

        const unpaidSales = await Sale.find({
          customer: customer._id,
          debt: { $gt: 0 },
        }).sort({ date: 1 });

        for (const sale of unpaidSales) {
          if (remainingToApply <= 0) break;
          const apply = Math.min(sale.debt, remainingToApply);
          sale.paid = roundMoney(sale.paid + apply);
          sale.debt = roundMoney(sale.debt - apply);
          sale.paymentStatus = paymentStatus(sale.paid, sale.total);
          await sale.save();
          allocations.push({ sale: sale._id, amount: apply });
          remainingToApply = roundMoney(remainingToApply - apply);
        }

        customer.totalPaid = roundMoney(customer.totalPaid + amount);
        customer.totalDebt = roundMoney(customer.totalDebt - amount);
        await customer.save();

        const payment = await CustomerPayment.create({
          customer: customer._id,
          amount,
          previousDebt,
          remainingDebt: customer.totalDebt,
          method: parameters.method || 'cash',
          notes: parameters.notes || 'Recorded via AI Assistant',
          allocations,
          createdBy: user._id,
          date: new Date(),
        });

        executionResult = {
          success: true,
          paymentId: payment._id,
          customerName: customer.name,
          amountPaid: amount,
          previousDebt,
          remainingDebt: customer.totalDebt,
          messageEn: `Payment of \$${amount} for "${customer.name}" was successfully recorded! Remaining debt is \$${customer.totalDebt}.`,
          messageSo: `Lacag-bixinta \$${amount} ee "${customer.name}" si guul leh ayaa loo diiwaangeliyay! Daynta u hartay waa \$${customer.totalDebt}.`,
        };
        break;
      }

      case 'record_expense': {
        const expense = await Expense.create({
          name: parameters.name,
          category: parameters.category,
          amount: parameters.amount,
          date: parameters.date || new Date(),
          description: parameters.description || '',
          createdBy: user._id,
        });

        executionResult = {
          success: true,
          expenseId: expense._id,
          name: expense.name,
          category: expense.category,
          amount: expense.amount,
          messageEn: `Expense "${expense.name}" (\$${expense.amount} - ${expense.category}) successfully recorded!`,
          messageSo: `Kharashka "${expense.name}" (\$${expense.amount} - ${expense.category}) si guul leh ayaa loo diiwaangeliyay!`,
        };
        break;
      }

      case 'update_product': {
        const product = await Product.findById(parameters.productId);
        if (!product || product.isDeleted) throw new AppError('Product not found.', 404);

        Object.assign(product, parameters.updates);
        await product.save();

        executionResult = {
          success: true,
          productId: product._id,
          productName: product.name,
          sellingPrice: product.sellingPrice,
          purchasePrice: product.purchasePrice,
          minStock: product.minStock,
          messageEn: `Product "${product.name}" successfully updated!`,
          messageSo: `Alaabta "${product.name}" si guul leh ayaa loo cusboonaysiiyay!`,
        };
        break;
      }

      case 'record_purchase': {
        const supplier = await Supplier.findById(parameters.supplierId);
        if (!supplier) throw new AppError('Supplier not found.', 404);

        const invoiceNumber = await nextNumber('purchase', 'PUR');
        const purchase = await Purchase.create({
          invoiceNumber,
          supplier: supplier._id,
          total: parameters.total,
          paid: parameters.paid,
          remaining: parameters.remaining,
          paymentStatus: paymentStatus(parameters.paid, parameters.total),
          notes: parameters.notes || 'Recorded via AI Assistant',
          createdBy: user._id,
          date: new Date(),
          items: [],
        });

        const createdItems = [];
        for (const row of parameters.items) {
          const prod = await Product.findById(row.productId);
          if (!prod) continue;

          const pItem = await PurchaseItem.create({
            purchase: purchase._id,
            product: prod._id,
            productName: prod.name,
            sku: prod.sku,
            quantity: row.quantity,
            purchasePrice: row.purchasePrice,
            lineTotal: row.lineTotal,
          });
          createdItems.push(pItem._id);

          prod.purchasePrice = row.purchasePrice;
          prod.costPrice = row.purchasePrice;
          await prod.save();

          await applyStockChange({
            productId: prod._id,
            quantity: row.quantity,
            type: 'in',
            reason: 'purchase',
            referenceType: 'purchase',
            referenceId: purchase._id,
            referenceNumber: invoiceNumber,
            createdBy: user._id,
          });
        }

        purchase.items = createdItems;
        await purchase.save();

        supplier.totalPurchases = roundMoney(supplier.totalPurchases + parameters.total);
        supplier.amountPaid = roundMoney(supplier.amountPaid + parameters.paid);
        supplier.amountDue = roundMoney(supplier.amountDue + parameters.remaining);
        await supplier.save();

        executionResult = {
          success: true,
          purchaseId: purchase._id,
          invoiceNumber,
          supplierName: supplier.name,
          total: parameters.total,
          paid: parameters.paid,
          remaining: parameters.remaining,
          messageEn: `Purchase order ${invoiceNumber} (\$${parameters.total}) successfully recorded and inventory restocked!`,
          messageSo: `Dalabka soo iibsiga ${invoiceNumber} (\$${parameters.total}) si guul leh ayaa loo diiwaangeliyay alaabtana kaydka loogu daray!`,
        };
        break;
      }

      default:
        throw new AppError(`Unknown action type: ${actionType}`, 400);
    }

    // Write to AiAuditLog
    await AiAuditLog.create({
      user: user._id,
      userEmail: user.email,
      userRole: user.role,
      actionType,
      actionSummary: summaryEn,
      parameters,
      result: executionResult,
      status: 'success',
      ip,
    });

    // Remove from staged actions so it cannot be executed twice
    stagedActions.delete(actionId);

    return executionResult;
  } catch (error) {
    // Log failed execution attempt
    await AiAuditLog.create({
      user: user._id,
      userEmail: user.email,
      userRole: user.role,
      actionType,
      actionSummary: summaryEn,
      parameters,
      status: 'failed',
      errorMessage: error.message,
      ip,
    }).catch(() => {});

    throw error;
  }
}

module.exports = {
  getSalesMetrics,
  getProfitMetrics,
  getInventoryStatus,
  getStockMovements,
  getCustomerDebts,
  getExpensesSummary,
  getSuppliersSummary,
  getBusinessOverview,
  prepareAddProduct,
  prepareAdjustStock,
  prepareCustomerPayment,
  prepareExpense,
  prepareUpdateProduct,
  preparePurchase,
  executeConfirmedAction,
  stagedActions,
};
