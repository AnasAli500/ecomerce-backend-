const { body } = require('express-validator');
const { Sale, SaleItem, Product, Customer, StockMovement } = require('../models');
const { applyStockChange } = require('../services/stockService');
const { nextNumber } = require('../utils/invoice');
const { paymentStatus, roundMoney } = require('../utils/money');
const { success, paginated } = require('../utils/apiResponse');
const { parsePagination, paginationMeta } = require('../utils/pagination');
const { resolvePeriod } = require('../utils/dateRange');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { escapeRegex } = require('../utils/escapeRegex');

const saleValidators = [
  body('customer').notEmpty().withMessage('Customer is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one product is required'),
  body('paid').isFloat({ min: 0 }).withMessage('Paid amount is required'),
];

const listSales = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = parsePagination(req.query);
  const filter = {};
  if (req.query.search) {
    filter.invoiceNumber = new RegExp(escapeRegex(req.query.search), 'i');
  }
  if (req.query.customer) filter.customer = req.query.customer;
  if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;
  const range = resolvePeriod(req.query);
  if (range) filter.date = { $gte: range.from, $lte: range.to };

  const [items, total] = await Promise.all([
    Sale.find(filter)
      .populate('customer', 'name phone')
      .populate('createdBy', 'name')
      .populate('items')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Sale.countDocuments(filter),
  ]);
  paginated(res, items, paginationMeta(total, page, limit));
});

const getSale = asyncHandler(async (req, res) => {
  const sale = await Sale.findById(req.params.id)
    .populate('customer')
    .populate('createdBy', 'name email')
    .populate('items');
  if (!sale) throw new AppError('Sale not found.', 404);
  success(res, { sale });
});

const createSale = asyncHandler(async (req, res) => {
  const { customer: customerId, items, discount = 0, paid, notes } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new AppError('At least one product is required.', 400);
  }

  const customer = await Customer.findById(customerId);
  if (!customer) throw new AppError('Customer not found.', 404);

  let subtotal = 0;
  const prepared = [];

  for (const item of items) {
    if (!item.product) {
      throw new AppError('Product selection is required for all items.', 400);
    }
    const product = await Product.findById(item.product);
    if (!product || product.isDeleted || product.status !== 'active') {
      throw new AppError('One of the selected products is unavailable.', 400);
    }
    const qty = Number(item.quantity);
    if (isNaN(qty) || qty <= 0) {
      throw new AppError('Quantity must be greater than 0 for all items.', 400);
    }
    if (product.currentStock < qty) {
      throw new AppError(`Insufficient stock for ${product.name}. Available: ${product.currentStock}`, 400);
    }
    const sellingPrice = Number(item.sellingPrice ?? product.sellingPrice);
    if (isNaN(sellingPrice) || sellingPrice < 0) {
      throw new AppError('Price cannot be negative.', 400);
    }
    const lineDiscount = Number(item.discount || 0);
    if (isNaN(lineDiscount) || lineDiscount < 0) {
      throw new AppError('Line discount cannot be negative.', 400);
    }
    const lineTotal = roundMoney(Math.max(sellingPrice * qty - lineDiscount, 0));
    subtotal += lineTotal;
    prepared.push({
      product,
      quantity: qty,
      sellingPrice,
      purchasePrice: product.purchasePrice,
      discount: lineDiscount,
      lineTotal,
      productName: product.name,
      sku: product.sku,
    });
  }

  const orderDiscount = roundMoney(Math.max(Number(discount) || 0, 0));
  const total = roundMoney(Math.max(subtotal - orderDiscount, 0));

  const rawPaid = Number(paid);
  if (isNaN(rawPaid) || rawPaid < 0) {
    throw new AppError('Paid amount is invalid.', 400);
  }
  if (rawPaid > total) {
    throw new AppError('Paid amount cannot exceed the final total.', 400);
  }
  if (customer.isWalkIn && rawPaid < total) {
    throw new AppError('Normal Customer must pay in full', 400);
  }

  const paidAmount = roundMoney(rawPaid);
  const debt = roundMoney(total - paidAmount);
  const invoiceNumber = await nextNumber('sale', 'SALE');

  const sale = await Sale.create({
    invoiceNumber,
    customer: customer._id,
    subtotal: roundMoney(subtotal),
    discount: orderDiscount,
    total,
    paid: paidAmount,
    debt,
    paymentStatus: paymentStatus(paidAmount, total),
    notes: notes || '',
    createdBy: req.user._id,
    date: req.body.date ? new Date(req.body.date) : new Date(),
    items: [],
  });

  const createdItems = [];
  for (const row of prepared) {
    const saleItem = await SaleItem.create({
      sale: sale._id,
      product: row.product._id,
      productName: row.productName,
      sku: row.sku,
      quantity: row.quantity,
      sellingPrice: row.sellingPrice,
      purchasePrice: row.purchasePrice,
      discount: row.discount,
      lineTotal: row.lineTotal,
    });
    createdItems.push(saleItem._id);
    await applyStockChange({
      productId: row.product._id,
      quantity: row.quantity,
      type: 'out',
      reason: 'sale',
      referenceType: 'sale',
      referenceId: sale._id,
      referenceNumber: invoiceNumber,
      createdBy: req.user._id,
    });
  }

  sale.items = createdItems;
  await sale.save();

  customer.totalPurchases = roundMoney(customer.totalPurchases + total);
  customer.totalPaid = roundMoney(customer.totalPaid + paidAmount);
  customer.totalDebt = roundMoney(customer.totalDebt + debt);
  await customer.save();

  const fresh = await Sale.findById(sale._id)
    .populate('customer')
    .populate('createdBy', 'name')
    .populate('items');
  success(res, { sale: fresh }, 'Sale completed', 201);
});

// ─── UPDATE SALE ──────────────────────────────────────────────────────────────
const updateSale = asyncHandler(async (req, res) => {
  const sale = await Sale.findById(req.params.id).populate('items');
  if (!sale) throw new AppError('Sale not found.', 404);

  const { customer: customerId, items, discount = 0, paid, notes } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new AppError('At least one product is required.', 400);
  }

  const customer = await Customer.findById(customerId);
  if (!customer) throw new AppError('Customer not found.', 404);

  // 1. Reverse old customer totals
  const oldCustomer = await Customer.findById(sale.customer);
  if (oldCustomer) {
    oldCustomer.totalPurchases = roundMoney(Math.max(oldCustomer.totalPurchases - sale.total, 0));
    oldCustomer.totalPaid = roundMoney(Math.max(oldCustomer.totalPaid - sale.paid, 0));
    oldCustomer.totalDebt = roundMoney(Math.max(oldCustomer.totalDebt - sale.debt, 0));
    await oldCustomer.save();
  }

  // 2. Reverse old stock and delete old items
  const oldItems = await SaleItem.find({ sale: sale._id });
  for (const oldItem of oldItems) {
    try {
      await applyStockChange({
        productId: oldItem.product,
        quantity: oldItem.quantity,
        type: 'in',
        reason: 'sale_edit_reversal',
        referenceType: 'sale',
        referenceId: sale._id,
        referenceNumber: sale.invoiceNumber,
        createdBy: req.user._id,
      });
    } catch (err) {
      console.error('[saleController] Stock reversal failed for item', String(oldItem.product), ':', err.message);
    }
  }
  await SaleItem.deleteMany({ sale: sale._id });

  // 3. Build new items
  let subtotal = 0;
  const prepared = [];

  for (const item of items) {
    if (!item.product) {
      throw new AppError('Product selection is required for all items.', 400);
    }
    const product = await Product.findById(item.product);
    if (!product || product.isDeleted || product.status !== 'active') {
      throw new AppError('One of the products is unavailable.', 400);
    }
    const qty = Number(item.quantity);
    if (isNaN(qty) || qty <= 0) {
      throw new AppError('Quantity must be greater than 0 for all items.', 400);
    }
    if (product.currentStock < qty) {
      throw new AppError(`Insufficient stock for ${product.name}. Available: ${product.currentStock}`, 400);
    }
    const sellingPrice = Number(item.sellingPrice ?? product.sellingPrice);
    if (isNaN(sellingPrice) || sellingPrice < 0) {
      throw new AppError('Price cannot be negative.', 400);
    }
    const lineDiscount = Number(item.discount || 0);
    if (isNaN(lineDiscount) || lineDiscount < 0) {
      throw new AppError('Line discount cannot be negative.', 400);
    }
    const lineTotal = roundMoney(Math.max(sellingPrice * qty - lineDiscount, 0));
    subtotal += lineTotal;
    prepared.push({
      product,
      quantity: qty,
      sellingPrice,
      purchasePrice: product.purchasePrice,
      discount: lineDiscount,
      lineTotal,
      productName: product.name,
      sku: product.sku,
    });
  }

  const orderDiscount = roundMoney(Math.max(Number(discount) || 0, 0));
  const total = roundMoney(Math.max(subtotal - orderDiscount, 0));

  const rawPaid = Number(paid);
  if (isNaN(rawPaid) || rawPaid < 0) {
    throw new AppError('Paid amount is invalid.', 400);
  }
  if (rawPaid > total) {
    throw new AppError('Paid amount cannot exceed the final total.', 400);
  }
  if (customer.isWalkIn && rawPaid < total) {
    throw new AppError('Normal Customer must pay in full', 400);
  }

  const paidAmount = roundMoney(rawPaid);
  const debt = roundMoney(total - paidAmount);

  // 4. Create new sale items & apply stock
  const newItemIds = [];
  for (const row of prepared) {
    const saleItem = await SaleItem.create({
      sale: sale._id,
      product: row.product._id,
      productName: row.productName,
      sku: row.sku,
      quantity: row.quantity,
      sellingPrice: row.sellingPrice,
      purchasePrice: row.purchasePrice,
      discount: row.discount,
      lineTotal: row.lineTotal,
    });
    newItemIds.push(saleItem._id);
    await applyStockChange({
      productId: row.product._id,
      quantity: row.quantity,
      type: 'out',
      reason: 'sale',
      referenceType: 'sale',
      referenceId: sale._id,
      referenceNumber: sale.invoiceNumber,
      createdBy: req.user._id,
    });
  }

  // 5. Update sale document
  sale.customer = customer._id;
  sale.subtotal = roundMoney(subtotal);
  sale.discount = orderDiscount;
  sale.total = total;
  sale.paid = paidAmount;
  sale.debt = debt;
  sale.paymentStatus = paymentStatus(paidAmount, total);
  sale.notes = notes || '';
  sale.items = newItemIds;
  if (req.body.date) sale.date = new Date(req.body.date);
  await sale.save();

  // 6. Update new customer totals
  customer.totalPurchases = roundMoney(customer.totalPurchases + total);
  customer.totalPaid = roundMoney(customer.totalPaid + paidAmount);
  customer.totalDebt = roundMoney(customer.totalDebt + debt);
  await customer.save();

  const fresh = await Sale.findById(sale._id)
    .populate('customer')
    .populate('createdBy', 'name')
    .populate('items');
  success(res, { sale: fresh }, 'Sale updated');
});

// ─── DELETE SALE ──────────────────────────────────────────────────────────────
const deleteSale = asyncHandler(async (req, res) => {
  const sale = await Sale.findById(req.params.id);
  if (!sale) throw new AppError('Sale not found.', 404);

  // 1. Reverse stock
  const saleItems = await SaleItem.find({ sale: sale._id });
  for (const item of saleItems) {
    try {
      await applyStockChange({
        productId: item.product,
        quantity: item.quantity,
        type: 'in',
        reason: 'sale_deleted',
        referenceType: 'sale',
        referenceId: sale._id,
        referenceNumber: sale.invoiceNumber,
        createdBy: req.user._id,
      });
    } catch (err) {
      console.error('[saleController] Stock reversal on delete failed for item', String(item.product), ':', err.message);
    }
  }

  // 2. Reverse customer totals
  const customer = await Customer.findById(sale.customer);
  if (customer) {
    customer.totalPurchases = roundMoney(Math.max(customer.totalPurchases - sale.total, 0));
    customer.totalPaid = roundMoney(Math.max(customer.totalPaid - sale.paid, 0));
    customer.totalDebt = roundMoney(Math.max(customer.totalDebt - sale.debt, 0));
    await customer.save();
  }

  // 3. Remove all related records
  await SaleItem.deleteMany({ sale: sale._id });
  await StockMovement.deleteMany({ referenceType: 'sale', referenceId: sale._id });
  await sale.deleteOne();

  success(res, null, 'Sale deleted');
});

module.exports = { listSales, getSale, createSale, updateSale, deleteSale, saleValidators };
