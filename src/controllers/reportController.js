const {
  Sale,
  SaleItem,
  Purchase,
  Expense,
  Product,
  Customer,
  Supplier,
  StockMovement,
  CustomerPayment,
} = require('../models');
const { success } = require('../utils/apiResponse');
const {
  startOfDay,
  endOfDay,
  startOfWeek,
  startOfMonth,
  startOfYear,
  resolvePeriod,
} = require('../utils/dateRange');
const { roundMoney } = require('../utils/money');
const asyncHandler = require('../utils/asyncHandler');

function periodFromQuery(query) {
  const mapped = { daily: 'today', weekly: 'week', monthly: 'month', yearly: 'year' };
  const period = mapped[query.period] || query.period;
  const range = resolvePeriod({ ...query, period });
  if (range) return range;
  return { from: startOfDay(), to: endOfDay() };
}

async function buildReport(from, to) {
  const dateFilter = { $gte: from, $lte: to };

  const [sales, purchases, expenses, stockIn, stockOut, payments, saleItems] = await Promise.all([
    Sale.find({ date: dateFilter }),
    Purchase.find({ date: dateFilter }),
    Expense.find({ date: dateFilter }),
    StockMovement.find({ date: dateFilter, type: 'in' }),
    StockMovement.find({ date: dateFilter, type: 'out' }),
    CustomerPayment.find({ date: dateFilter }),
    SaleItem.find({ createdAt: dateFilter }),
  ]);

  const salesTotal = roundMoney(sales.reduce((sum, s) => sum + s.total, 0));
  const salesPaid = roundMoney(sales.reduce((sum, s) => sum + s.paid, 0));
  const salesDebt = roundMoney(sales.reduce((sum, s) => sum + s.debt, 0));
  const purchasesTotal = roundMoney(purchases.reduce((sum, p) => sum + p.total, 0));
  const expensesTotal = roundMoney(expenses.reduce((sum, e) => sum + e.amount, 0));
  const customerPayments = roundMoney(payments.reduce((sum, p) => sum + p.amount, 0));
  const stockInQty = stockIn.reduce((sum, m) => sum + m.quantity, 0);
  const stockOutQty = stockOut.reduce((sum, m) => sum + m.quantity, 0);
  const discounts = roundMoney(sales.reduce((sum, s) => sum + s.discount, 0));

  const grossProfit = roundMoney(
    saleItems.reduce((sum, item) => {
      const lineGross = (item.sellingPrice - item.purchasePrice) * item.quantity - item.discount;
      return sum + lineGross;
    }, 0) - discounts
  );
  const netProfit = roundMoney(grossProfit - expensesTotal);

  return {
    from,
    to,
    sales: salesTotal,
    salesPaid,
    customerDebt: salesDebt,
    purchases: purchasesTotal,
    stockIn: stockInQty,
    stockOut: stockOutQty,
    expenses: expensesTotal,
    customerPayments,
    discounts,
    grossProfit,
    netProfit,
    profit: netProfit,
    transactions: sales.length + purchases.length + payments.length + expenses.length,
    counts: {
      sales: sales.length,
      purchases: purchases.length,
      payments: payments.length,
      expenses: expenses.length,
      stockMovements: stockIn.length + stockOut.length,
    },
  };
}

const dashboard = asyncHandler(async (_req, res) => {
  const todayFrom = startOfDay();
  const todayTo = endOfDay();

  const [
    products,
    customers,
    suppliers,
    salesAll,
    purchasesAll,
    expensesAll,
    todaySales,
    todayItems,
    todayExpenses,
    lowStock,
  ] = await Promise.all([
    Product.find({ isDeleted: false }),
    Customer.find(),
    Supplier.find(),
    Sale.find(),
    Purchase.find(),
    Expense.find(),
    Sale.find({ date: { $gte: todayFrom, $lte: todayTo } }),
    SaleItem.find({ createdAt: { $gte: todayFrom, $lte: todayTo } }),
    Expense.find({ date: { $gte: todayFrom, $lte: todayTo } }),
    Product.find({
      isDeleted: false,
      $expr: { $lte: ['$currentStock', '$minStock'] },
    }).populate('category', 'name').limit(10),
  ]);

  const totalSales = roundMoney(salesAll.reduce((s, x) => s + x.total, 0));
  const totalPurchases = roundMoney(purchasesAll.reduce((s, x) => s + x.total, 0));
  const totalExpenses = roundMoney(expensesAll.reduce((s, x) => s + x.amount, 0));
  const totalCustomerDebt = roundMoney(customers.reduce((s, x) => s + x.totalDebt, 0));
  const currentStockValue = roundMoney(products.reduce((s, p) => s + p.currentStock * p.purchasePrice, 0));
  const todaysSales = roundMoney(todaySales.reduce((s, x) => s + x.total, 0));
  const todayGross = roundMoney(
    todayItems.reduce((sum, item) => sum + ((item.sellingPrice - item.purchasePrice) * item.quantity - item.discount), 0)
  );
  const todayDiscount = roundMoney(todaySales.reduce((s, x) => s + x.discount, 0));
  const todayExpenseTotal = roundMoney(todayExpenses.reduce((s, x) => s + x.amount, 0));
  const todaysProfit = roundMoney(todayGross - todayDiscount - todayExpenseTotal);

  const now = new Date();
  const daily = [];
  for (let i = 6; i >= 0; i -= 1) {
    const day = new Date(now);
    day.setDate(now.getDate() - i);
    const from = startOfDay(day);
    const to = endOfDay(day);
    const daySales = salesAll.filter((s) => s.date >= from && s.date <= to);
    daily.push({
      label: from.toLocaleDateString(undefined, { weekday: 'short' }),
      sales: roundMoney(daySales.reduce((sum, s) => sum + s.total, 0)),
    });
  }

  const weekly = [];
  for (let i = 3; i >= 0; i -= 1) {
    const start = startOfWeek(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7));
    const end = endOfDay(new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000));
    const weekSales = salesAll.filter((s) => s.date >= start && s.date <= end);
    weekly.push({
      label: `W${4 - i}`,
      sales: roundMoney(weekSales.reduce((sum, s) => sum + s.total, 0)),
    });
  }

  const monthly = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const from = startOfMonth(d);
    const to = endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    const monthSales = salesAll.filter((s) => s.date >= from && s.date <= to);
    monthly.push({
      label: from.toLocaleDateString(undefined, { month: 'short' }),
      sales: roundMoney(monthSales.reduce((sum, s) => sum + s.total, 0)),
    });
  }

  const yearly = [];
  for (let i = 3; i >= 0; i -= 1) {
    const year = now.getFullYear() - i;
    const from = startOfYear(new Date(year, 0, 1));
    const to = endOfDay(new Date(year, 11, 31));
    const yearSales = salesAll.filter((s) => s.date >= from && s.date <= to);
    yearly.push({
      label: String(year),
      sales: roundMoney(yearSales.reduce((sum, s) => sum + s.total, 0)),
    });
  }

  success(res, {
    totals: {
      totalSales,
      totalPurchases,
      totalProducts: products.length,
      totalCustomers: customers.length,
      totalSuppliers: suppliers.length,
      totalCustomerDebt,
      totalExpenses,
      currentStockValue,
      todaysSales,
      todaysProfit,
    },
    lowStock,
    charts: { daily, weekly, monthly, yearly },
  });
});

const report = asyncHandler(async (req, res) => {
  const { from, to } = periodFromQuery(req.query);
  const data = await buildReport(from, to);
  success(res, data);
});

module.exports = { dashboard, report, buildReport };
