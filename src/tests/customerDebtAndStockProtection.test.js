const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { connectDb } = require('../config/db');
const { app } = require('../server');
const { User, Category, Product, Customer, Sale, CustomerPayment, StockMovement, Purchase, Supplier } = require('../models');
const { signToken } = require('../utils/token');

describe('Customer Debt Management & Out-of-Stock Protection Tests', () => {
  let server;
  let baseUrl;
  let adminToken;
  let adminUser;
  let testCustomer;
  let testCategory;
  let inStockProduct;
  let zeroStockProduct;

  const cleanupSales = [];
  const cleanupProducts = [];
  const cleanupCustomers = [];
  const cleanupPayments = [];

  before(async () => {
    await connectDb();

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    adminUser = await User.findOne({ role: 'admin', status: 'active' });
    if (!adminUser) {
      adminUser = await User.create({
        name: 'Debt Test Admin',
        email: `debt_admin_${Date.now()}@test.com`,
        password: 'password123',
        role: 'admin',
        status: 'active',
      });
    }
    adminToken = signToken(adminUser._id);

    testCategory = await Category.findOne({ status: 'active' });
    if (!testCategory) {
      testCategory = await Category.create({ name: `TestCat_${Date.now()}` });
    }

    testCustomer = await Customer.create({
      name: `Credit Customer ${Date.now()}`,
      phone: '0612345678',
      email: `credit_${Date.now()}@example.com`,
      isWalkIn: false,
    });
    cleanupCustomers.push(testCustomer._id);

    inStockProduct = await Product.create({
      name: `In-Stock Gadget ${Date.now()}`,
      sku: `INS_${Date.now()}`,
      category: testCategory._id,
      sellingPrice: 100,
      purchasePrice: 60,
      costPrice: 60,
      currentStock: 10,
      minStock: 2,
    });
    cleanupProducts.push(inStockProduct._id);

    zeroStockProduct = await Product.create({
      name: `Zero-Stock Gadget ${Date.now()}`,
      sku: `ZER_${Date.now()}`,
      category: testCategory._id,
      sellingPrice: 150,
      purchasePrice: 80,
      costPrice: 80,
      currentStock: 0,
      minStock: 2,
    });
    cleanupProducts.push(zeroStockProduct._id);
  });

  after(async () => {
    if (server) await new Promise((res) => server.close(res));
    if (cleanupSales.length > 0) await Sale.deleteMany({ _id: { $in: cleanupSales } });
    if (cleanupPayments.length > 0) await CustomerPayment.deleteMany({ _id: { $in: cleanupPayments } });
    if (cleanupProducts.length > 0) await Product.deleteMany({ _id: { $in: cleanupProducts } });
    if (cleanupCustomers.length > 0) await Customer.deleteMany({ _id: { $in: cleanupCustomers } });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // FEATURE 1: CUSTOMER DEBT MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────
  describe('1. Customer Debt Recording on Credit Sale', () => {
    it('records sale on credit and updates customer totalDebt, totalPaid, totalPurchases', async () => {
      // Sale of 2 units of inStockProduct = $200. Paid: $50. Unpaid debt: $150.
      const res = await fetch(`${baseUrl}/api/sales`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          customer: testCustomer._id,
          items: [{ product: inStockProduct._id, quantity: 2, sellingPrice: 100 }],
          paid: 50,
          notes: 'Sold on credit',
        }),
      });

      assert.equal(res.status, 201);
      const json = await res.json();
      const sale = json.data.sale;
      cleanupSales.push(sale._id);

      assert.equal(sale.total, 200);
      assert.equal(sale.paid, 50);
      assert.equal(sale.debt, 150);
      assert.equal(sale.paymentStatus, 'Partial');

      const freshCustomer = await Customer.findById(testCustomer._id);
      assert.equal(freshCustomer.totalPurchases, 200);
      assert.equal(freshCustomer.totalPaid, 50);
      assert.equal(freshCustomer.totalDebt, 150);
    });
  });

  describe('2. Partial and Full Debt Payments', () => {
    it('records partial debt payment and updates remaining balance accurately', async () => {
      const res = await fetch(`${baseUrl}/api/payments/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          customer: testCustomer._id,
          amount: 50,
          method: 'cash',
          notes: 'First partial payment',
        }),
      });

      assert.equal(res.status, 201);
      const json = await res.json();
      const payment = json.data.payment;
      cleanupPayments.push(payment._id);

      assert.equal(payment.amount, 50);
      assert.equal(payment.previousDebt, 150);
      assert.equal(payment.remainingDebt, 100);

      const freshCustomer = await Customer.findById(testCustomer._id);
      assert.equal(freshCustomer.totalDebt, 100);
      assert.equal(freshCustomer.totalPaid, 100);
    });

    it('rejects duplicate payment within 4 seconds with 409', async () => {
      // Trying to submit the exact same amount for the same customer immediately
      const res = await fetch(`${baseUrl}/api/payments/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          customer: testCustomer._id,
          amount: 50,
          method: 'cash',
        }),
      });

      assert.equal(res.status, 409);
      const json = await res.json();
      assert.match(json.message, /duplicate payment detected/i);
    });

    it('rejects payment amount greater than remaining debt', async () => {
      // Remaining debt is 100; trying to pay 200
      const res = await fetch(`${baseUrl}/api/payments/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          customer: testCustomer._id,
          amount: 200,
          method: 'transfer',
        }),
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.match(json.message, /cannot exceed remaining debt/i);
    });

    it('records full remaining debt payment settling customer balance to 0', async () => {
      // Pay full remaining $100
      const res = await fetch(`${baseUrl}/api/payments/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          customer: testCustomer._id,
          amount: 100,
          method: 'card',
          notes: 'Final settlement',
        }),
      });

      assert.equal(res.status, 201);
      const json = await res.json();
      const payment = json.data.payment;
      cleanupPayments.push(payment._id);

      assert.equal(payment.remainingDebt, 0);

      const freshCustomer = await Customer.findById(testCustomer._id);
      assert.equal(freshCustomer.totalDebt, 0);
      assert.equal(freshCustomer.totalPaid, 200);
      assert.equal(freshCustomer.debtStatus, 'Paid');
    });

    it('rejects payment when customer has no outstanding debt', async () => {
      const res = await fetch(`${baseUrl}/api/payments/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          customer: testCustomer._id,
          amount: 10,
        }),
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.match(json.message, /no outstanding debt/i);
    });
  });

  describe('3. Customer Debt Filters & History', () => {
    it('filters customers with outstanding debts vs fully paid', async () => {
      // Query outstanding
      const resDebt = await fetch(`${baseUrl}/api/customers?debtFilter=outstanding`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(resDebt.status, 200);
      const jsonDebt = await resDebt.json();
      // All returned customers must have totalDebt > 0
      for (const c of jsonDebt.data) {
        assert.ok(c.totalDebt > 0);
      }

      // Query fully paid
      const resPaid = await fetch(`${baseUrl}/api/customers?debtFilter=paid`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(resPaid.status, 200);
      const jsonPaid = await resPaid.json();
      for (const c of jsonPaid.data) {
        assert.ok(c.totalDebt <= 0);
      }
    });

    it('retrieves customer debt history with sales and payments', async () => {
      const res = await fetch(`${baseUrl}/api/customers/${testCustomer._id}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.data.customer._id, String(testCustomer._id));
      assert.ok(Array.isArray(json.data.sales));
      assert.ok(json.data.sales.length >= 1);
      assert.ok(Array.isArray(json.data.payments));
      assert.ok(json.data.payments.length >= 2);
      assert.equal(json.data.remainingBalance, 0);
    });

    it('displays total outstanding customer debt on the dashboard', async () => {
      const res = await fetch(`${baseUrl}/api/reports/dashboard`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.ok('totalCustomerDebt' in json.data.totals);
      assert.equal(typeof json.data.totals.totalCustomerDebt, 'number');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // FEATURE 2: OUT-OF-STOCK PRODUCT PROTECTION
  // ─────────────────────────────────────────────────────────────────────────────
  describe('4. Out-of-Stock Protection & Validation', () => {
    it('identifies product with currentStock = 0 as isOutOfStock: true', async () => {
      const prod = await Product.findById(zeroStockProduct._id);
      assert.equal(prod.currentStock, 0);
      assert.equal(prod.isOutOfStock, true);
    });

    it('prevents selling an out-of-stock product with 400 and clear message', async () => {
      const res = await fetch(`${baseUrl}/api/sales`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          customer: testCustomer._id,
          items: [{ product: zeroStockProduct._id, quantity: 1, sellingPrice: 150 }],
          paid: 150,
        }),
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.match(json.message, /out of stock/i);
    });

    it('prevents selling quantity greater than available stock with available quantity message', async () => {
      const freshInStock = await Product.findById(inStockProduct._id);
      const available = freshInStock.currentStock; // 8 left after 2 sold in previous test

      const res = await fetch(`${baseUrl}/api/sales`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          customer: testCustomer._id,
          items: [{ product: inStockProduct._id, quantity: available + 10, sellingPrice: 100 }],
          paid: 100,
        }),
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.match(json.message, /insufficient stock/i);
      assert.match(json.message, new RegExp(String(available)));
    });

    it('prevents stock adjustments that would cause negative stock', async () => {
      const res = await fetch(`${baseUrl}/api/stock/adjust`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          product: zeroStockProduct._id,
          quantity: 5,
          type: 'out',
          reason: 'damaged',
        }),
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.match(json.message, /insufficient stock|cannot become negative/i);

      // Verify stock did not become negative
      const checkProd = await Product.findById(zeroStockProduct._id);
      assert.equal(checkProd.currentStock, 0);
    });

    it('automatically updates availability when new stock is added via purchase', async () => {
      // Create supplier
      const supplier = await Supplier.create({
        name: `Stock Supplier ${Date.now()}`,
        company: 'Supplier Co',
        phone: '12345678',
      });

      // Purchase 10 units of zeroStockProduct
      const res = await fetch(`${baseUrl}/api/purchases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          supplier: supplier._id,
          items: [{ product: zeroStockProduct._id, quantity: 10, purchasePrice: 80 }],
          paid: 800,
        }),
      });

      assert.equal(res.status, 201);

      // Product stock should now be 10 and isOutOfStock should be false
      const freshProd = await Product.findById(zeroStockProduct._id);
      assert.equal(freshProd.currentStock, 10);
      assert.equal(freshProd.isOutOfStock, false);

      // It can now be successfully sold
      const saleRes = await fetch(`${baseUrl}/api/sales`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          customer: testCustomer._id,
          items: [{ product: zeroStockProduct._id, quantity: 2, sellingPrice: 150 }],
          paid: 300,
        }),
      });

      assert.equal(saleRes.status, 201);
      const saleJson = await saleRes.json();
      cleanupSales.push(saleJson.data.sale._id);

      const afterSaleProd = await Product.findById(zeroStockProduct._id);
      assert.equal(afterSaleProd.currentStock, 8);
    });
  });
});
