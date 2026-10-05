const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { connectDb } = require('../config/db');
const {
  User,
  Category,
  Product,
  Customer,
  Supplier,
  Sale,
  SaleItem,
  Purchase,
  PurchaseItem,
  StockMovement,
  CustomerPayment,
  SupplierPayment,
  Expense,
  Counter,
  Settings,
} = require('../models');
const { applyStockChange } = require('../services/stockService');
const { nextNumber } = require('../utils/invoice');
const { paymentStatus, roundMoney } = require('../utils/money');

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(10, 0, 0, 0);
  return d;
}

async function seed() {
  await connectDb();
  console.log('Seeding database...');

  await Promise.all([
    User.deleteMany({}),
    Category.deleteMany({}),
    Product.deleteMany({}),
    Customer.deleteMany({}),
    Supplier.deleteMany({}),
    Sale.deleteMany({}),
    SaleItem.deleteMany({}),
    Purchase.deleteMany({}),
    PurchaseItem.deleteMany({}),
    StockMovement.deleteMany({}),
    CustomerPayment.deleteMany({}),
    SupplierPayment.deleteMany({}),
    Expense.deleteMany({}),
    Counter.deleteMany({}),
    Settings.deleteMany({}),
  ]);

  const admin = await User.create({
    name: 'JILE Admin',
    email: 'admin@jileelectronics.com',
    password: 'Admin123!',
    role: 'admin',
    status: 'active',
    phone: '+252 61 111 1111',
  });

  await User.create({
    name: 'Cashier Staff',
    email: 'staff@jileelectronics.com',
    password: 'Staff123!',
    role: 'staff',
    status: 'active',
  });

  await Settings.create({
    storeName: 'JILE Electronics',
    phone: '+252 61 000 0000',
    email: 'info@jileelectronics.com',
    address: 'Maka Al Mukarama Road, Mogadishu',
    currency: 'USD',
    logoUrl: '/logo.png',
  });

  const [phones, laptops, accessories, chargers, headphones] = await Category.insertMany([
    { name: 'Phones', description: 'Smartphones' },
    { name: 'Laptops', description: 'Notebooks' },
    { name: 'Accessories', description: 'Cases and extras' },
    { name: 'Chargers', description: 'Power accessories' },
    { name: 'Headphones', description: 'Audio' },
  ]);

  const products = await Product.insertMany([
    {
      name: 'iPhone 17 Pro Max',
      sku: 'IP17PM',
      category: phones._id,
      sellingPrice: 1200,
      purchasePrice: 950,
      currentStock: 0,
      minStock: 5,
      status: 'active',
    },
    {
      name: 'iPhone 16 Pro Max',
      sku: 'IP16PM',
      category: phones._id,
      sellingPrice: 1050,
      purchasePrice: 820,
      currentStock: 0,
      minStock: 4,
      status: 'active',
    },
    {
      name: 'Samsung Galaxy S26',
      sku: 'SGS26',
      category: phones._id,
      sellingPrice: 980,
      purchasePrice: 760,
      currentStock: 0,
      minStock: 4,
      status: 'active',
    },
    {
      name: 'AirPods Pro',
      sku: 'APP2',
      category: headphones._id,
      sellingPrice: 220,
      purchasePrice: 150,
      currentStock: 0,
      minStock: 8,
      status: 'active',
    },
    {
      name: 'Phone Case',
      sku: 'CASE01',
      category: accessories._id,
      sellingPrice: 18,
      purchasePrice: 6,
      currentStock: 0,
      minStock: 20,
      status: 'active',
    },
    {
      name: 'Fast Charger 65W',
      sku: 'CHG65',
      category: chargers._id,
      sellingPrice: 35,
      purchasePrice: 14,
      currentStock: 0,
      minStock: 10,
      status: 'active',
    },
  ]);

  const [iphone17, iphone16, s26, airpods, phoneCase, charger] = products;

  const [ahmed, mohamed, abdi] = await Customer.insertMany([
    { name: 'Ahmed Ali', phone: '+252 61 200 1111', email: 'ahmed.ali@example.com', address: 'Hodan, Mogadishu' },
    { name: 'Mohamed Hassan', phone: '+252 61 200 2222', email: 'mohamed.hassan@example.com', address: 'Wadajir, Mogadishu' },
    { name: 'Abdi Noor', phone: '+252 61 200 3333', email: 'abdi.noor@example.com', address: 'Hamar Weyne, Mogadishu' },
  ]);

  const [samsungSomalia, appleSupplier, localAcc] = await Supplier.insertMany([
    { name: 'Samsung Somalia', phone: '+252 61 300 1111', email: 'sales@samsungsomalia.com', company: 'Samsung Somalia', address: 'KM4' },
    { name: 'Apple Supplier', phone: '+252 61 300 2222', email: 'orders@applesupplier.com', company: 'Apple Distributor', address: 'Airport Road' },
    { name: 'Local Accessories Supplier', phone: '+252 61 300 3333', email: 'local@accessories.com', company: 'Local Accessories', address: 'Bakaaro' },
  ]);

  async function recordPurchase({ supplier, date, paid, lines }) {
    let total = 0;
    const prepared = [];
    for (const line of lines) {
      const productDoc = await Product.findById(line.product);
      const lineTotal = roundMoney(line.purchasePrice * line.quantity);
      total += lineTotal;
      prepared.push({ productDoc, quantity: line.quantity, purchasePrice: line.purchasePrice, lineTotal });
    }
    total = roundMoney(total);
    const paidAmount = roundMoney(Math.min(paid, total));
    const remaining = roundMoney(total - paidAmount);
    const invoiceNumber = await nextNumber('purchase', 'PUR');
    const purchase = await Purchase.create({
      invoiceNumber,
      supplier: supplier._id,
      total,
      paid: paidAmount,
      remaining,
      paymentStatus: paymentStatus(paidAmount, total),
      createdBy: admin._id,
      date,
      items: [],
    });
    const itemIds = [];
    for (const row of prepared) {
      const item = await PurchaseItem.create({
        purchase: purchase._id,
        product: row.productDoc._id,
        productName: row.productDoc.name,
        sku: row.productDoc.sku,
        quantity: row.quantity,
        purchasePrice: row.purchasePrice,
        lineTotal: row.lineTotal,
      });
      itemIds.push(item._id);
      row.productDoc.purchasePrice = row.purchasePrice;
      await row.productDoc.save();
      await applyStockChange({
        productId: row.productDoc._id,
        quantity: row.quantity,
        type: 'in',
        reason: 'purchase',
        referenceType: 'purchase',
        referenceId: purchase._id,
        referenceNumber: invoiceNumber,
        createdBy: admin._id,
        date,
      });
    }
    purchase.items = itemIds;
    await purchase.save();
    supplier.totalPurchases = roundMoney(supplier.totalPurchases + total);
    supplier.amountPaid = roundMoney(supplier.amountPaid + paidAmount);
    supplier.amountDue = roundMoney(supplier.amountDue + remaining);
    await supplier.save();
    return purchase;
  }

  async function recordSale({ customer, date, paid, discount = 0, lines }) {
    let subtotal = 0;
    const prepared = [];
    for (const line of lines) {
      const product = await Product.findById(line.product);
      const sellingPrice = line.sellingPrice;
      const qty = line.quantity;
      const lineDiscount = line.discount || 0;
      const lineTotal = roundMoney(sellingPrice * qty - lineDiscount);
      subtotal += sellingPrice * qty;
      prepared.push({
        product,
        quantity: qty,
        sellingPrice,
        purchasePrice: product.purchasePrice,
        discount: lineDiscount,
        lineTotal,
      });
    }
    const total = roundMoney(Math.max(subtotal - discount, 0));
    const paidAmount = roundMoney(Math.min(paid, total));
    const debt = roundMoney(total - paidAmount);
    const invoiceNumber = await nextNumber('sale', 'SALE');
    const sale = await Sale.create({
      invoiceNumber,
      customer: customer._id,
      subtotal: roundMoney(subtotal),
      discount,
      total,
      paid: paidAmount,
      debt,
      paymentStatus: paymentStatus(paidAmount, total),
      createdBy: admin._id,
      date,
      items: [],
    });
    const itemIds = [];
    for (const row of prepared) {
      const item = await SaleItem.create({
        sale: sale._id,
        product: row.product._id,
        productName: row.product.name,
        sku: row.product.sku,
        quantity: row.quantity,
        sellingPrice: row.sellingPrice,
        purchasePrice: row.purchasePrice,
        discount: row.discount,
        lineTotal: row.lineTotal,
        createdAt: date,
      });
      itemIds.push(item._id);
      await applyStockChange({
        productId: row.product._id,
        quantity: row.quantity,
        type: 'out',
        reason: 'sale',
        referenceType: 'sale',
        referenceId: sale._id,
        referenceNumber: invoiceNumber,
        createdBy: admin._id,
        date,
      });
    }
    sale.items = itemIds;
    await sale.save();
    customer.totalPurchases = roundMoney(customer.totalPurchases + total);
    customer.totalPaid = roundMoney(customer.totalPaid + paidAmount);
    customer.totalDebt = roundMoney(customer.totalDebt + debt);
    await customer.save();
    return sale;
  }

  await recordPurchase({
    supplier: appleSupplier,
    date: daysAgo(20),
    paid: 20000,
    lines: [
      { product: iphone17._id, quantity: 12, purchasePrice: 950 },
      { product: iphone16._id, quantity: 10, purchasePrice: 820 },
      { product: airpods._id, quantity: 20, purchasePrice: 150 },
    ],
  });

  await recordPurchase({
    supplier: samsungSomalia,
    date: daysAgo(12),
    paid: 5000,
    lines: [{ product: s26._id, quantity: 10, purchasePrice: 760 }],
  });

  await recordPurchase({
    supplier: localAcc,
    date: daysAgo(8),
    paid: 400,
    lines: [
      { product: phoneCase._id, quantity: 40, purchasePrice: 6 },
      { product: charger._id, quantity: 25, purchasePrice: 14 },
    ],
  });

  await recordSale({
    customer: ahmed,
    date: daysAgo(10),
    paid: 800,
    discount: 50,
    lines: [{ product: iphone17._id, quantity: 1, sellingPrice: 1200, discount: 0 }],
  });

  await recordSale({
    customer: mohamed,
    date: daysAgo(6),
    paid: 980,
    discount: 0,
    lines: [{ product: s26._id, quantity: 1, sellingPrice: 980 }],
  });

  await recordSale({
    customer: abdi,
    date: daysAgo(3),
    paid: 100,
    discount: 0,
    lines: [
      { product: airpods._id, quantity: 1, sellingPrice: 220 },
      { product: phoneCase._id, quantity: 2, sellingPrice: 18 },
    ],
  });

  await recordSale({
    customer: ahmed,
    date: daysAgo(0),
    paid: 1050,
    discount: 0,
    lines: [{ product: iphone16._id, quantity: 1, sellingPrice: 1050 }],
  });

  await applyStockChange({
    productId: phoneCase._id,
    quantity: 2,
    type: 'out',
    reason: 'damaged',
    referenceType: 'adjustment',
    referenceNumber: 'ADJ-DAMAGE',
    notes: 'Damaged in store',
    createdBy: admin._id,
  });

  const ahmedFresh = await Customer.findById(ahmed._id);
  const payAmount = 100;
  const previousDebt = ahmedFresh.totalDebt;
  const unpaidSales = await Sale.find({ customer: ahmed._id, debt: { $gt: 0 } }).sort({ date: 1 });
  let remainingToApply = payAmount;
  const allocations = [];
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
  ahmedFresh.totalPaid = roundMoney(ahmedFresh.totalPaid + payAmount);
  ahmedFresh.totalDebt = roundMoney(ahmedFresh.totalDebt - payAmount);
  await ahmedFresh.save();
  await CustomerPayment.create({
    customer: ahmed._id,
    amount: payAmount,
    previousDebt,
    remainingDebt: ahmedFresh.totalDebt,
    method: 'cash',
    notes: 'Partial debt payment',
    allocations,
    createdBy: admin._id,
    date: daysAgo(2),
  });

  await Expense.insertMany([
    { name: 'Shop Rent', category: 'Rent', amount: 400, description: 'Monthly rent', date: daysAgo(5), createdBy: admin._id },
    { name: 'Electricity Bill', category: 'Electricity', amount: 85, description: 'Power', date: daysAgo(2), createdBy: admin._id },
    { name: 'Internet', category: 'Internet', amount: 40, description: 'Fiber', date: daysAgo(1), createdBy: admin._id },
    { name: 'Staff Transport', category: 'Transport', amount: 25, description: 'Delivery', date: daysAgo(0), createdBy: admin._id },
  ]);

  console.log('Seed complete.');
  console.log('Admin login: admin@jileelectronics.com / Admin123!');
  console.log('Staff login: staff@jileelectronics.com / Staff123!');
  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
