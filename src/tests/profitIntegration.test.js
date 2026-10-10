const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { connectDb } = require('../config/db');
const { app } = require('../server');
const { User, Category, Product, Customer, Sale, SaleItem } = require('../models');
const { signToken } = require('../utils/token');

describe('Profit Integration Test', () => {
  let server;
  let baseUrl;
  let adminToken;
  let staffToken;
  let adminUser;
  let testCustomer;
  let testCategory;
  let product1;
  let product2;
  const createdSaleIds = [];
  const createdProductIds = [];

  before(async () => {
    await connectDb();

    // Start server on free port
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    // Setup admin user
    adminUser = await User.findOne({ role: 'admin', status: 'active' });
    if (!adminUser) {
      adminUser = await User.create({
        name: 'Test Admin',
        email: `testadmin_${Date.now()}@example.com`,
        password: 'password123',
        role: 'admin',
        status: 'active',
      });
    }
    adminToken = signToken(adminUser._id);

    // Setup staff user for auth test
    let staffUser = await User.findOne({ role: 'staff', status: 'active' });
    if (!staffUser) {
      staffUser = await User.create({
        name: 'Test Staff',
        email: `teststaff_${Date.now()}@example.com`,
        password: 'password123',
        role: 'staff',
        status: 'active',
      });
    }
    staffToken = signToken(staffUser._id);

    // Setup customer
    testCustomer = await Customer.findOne({ isWalkIn: true });
    if (!testCustomer) {
      testCustomer = await Customer.create({
        name: 'Normal Customer',
        phone: '-',
        isWalkIn: true,
        status: 'active',
      });
    }

    // Setup category
    testCategory = await Category.findOne();
    if (!testCategory) {
      testCategory = await Category.create({ name: 'Integration Test Cat' });
    }

    // Setup 2 test products with different cost and selling prices
    product1 = await Product.create({
      name: `Test Product 1 ${Date.now()}`,
      sku: `TP1_${Date.now()}`,
      category: testCategory._id,
      sellingPrice: 150,
      costPrice: 90,
      purchasePrice: 90,
      currentStock: 100,
      minStock: 5,
      status: 'active',
    });
    createdProductIds.push(product1._id);

    product2 = await Product.create({
      name: `Test Product 2 ${Date.now()}`,
      sku: `TP2_${Date.now()}`,
      category: testCategory._id,
      sellingPrice: 220,
      costPrice: 140,
      purchasePrice: 140,
      currentStock: 100,
      minStock: 5,
      status: 'active',
    });
    createdProductIds.push(product2._id);
  });

  after(async () => {
    // Clean up created test sales and products
    if (createdSaleIds.length > 0) {
      await SaleItem.deleteMany({ sale: { $in: createdSaleIds } });
      await Sale.deleteMany({ _id: { $in: createdSaleIds } });
    }
    if (createdProductIds.length > 0) {
      await Product.deleteMany({ _id: { $in: createdProductIds } });
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.disconnect();
  });

  it('enforces admin-only access on GET /api/sales/profit', async () => {
    // Unauthenticated
    const unauthRes = await fetch(`${baseUrl}/api/sales/profit`);
    assert.equal(unauthRes.status, 401);

    // Staff user (forbidden)
    const staffRes = await fetch(`${baseUrl}/api/sales/profit`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert.equal(staffRes.status, 403);

    // Admin user (allowed)
    const adminRes = await fetch(`${baseUrl}/api/sales/profit`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminRes.status, 200);
  });

  it('creates 2 sales with different cost prices and discounts, and verifies costPrice snapshot', async () => {
    // Sale 1: Product 1 (qty: 2, selling: 150, cost: 90, lineDiscount: 10), orderDiscount: 15
    // Subtotal: (150 * 2 - 10) = 290. Total = 290 - 15 = 275.
    // Sale profit: (150 - 90) * 2 - 10 - 15 = 120 - 10 - 15 = 95.
    const sale1Payload = {
      customer: testCustomer._id,
      items: [
        {
          product: product1._id,
          quantity: 2,
          sellingPrice: 150,
          discount: 10,
        },
      ],
      discount: 15,
      paid: 275,
      notes: 'Integration sale 1',
      date: new Date(),
    };

    const res1 = await fetch(`${baseUrl}/api/sales`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(sale1Payload),
    });
    const data1 = await res1.json();
    assert.equal(res1.status, 201);
    assert.ok(data1.data?.sale?._id);
    createdSaleIds.push(data1.data.sale._id);

    // Verify snapshot of costPrice on created SaleItem
    const savedItem1 = await SaleItem.findOne({ sale: data1.data.sale._id });
    assert.equal(savedItem1.costPrice, 90);

    // Sale 2: Product 2 (qty: 1, selling: 220, cost: 140, lineDiscount: 20), orderDiscount: 10
    // Subtotal: (220 * 1 - 20) = 200. Total = 200 - 10 = 190.
    // Sale profit: (220 - 140) * 1 - 20 - 10 = 80 - 20 - 10 = 50.
    const sale2Payload = {
      customer: testCustomer._id,
      items: [
        {
          product: product2._id,
          quantity: 1,
          sellingPrice: 220,
          discount: 20,
        },
      ],
      discount: 10,
      paid: 190,
      notes: 'Integration sale 2',
      date: new Date(),
    };

    const res2 = await fetch(`${baseUrl}/api/sales`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(sale2Payload),
    });
    const data2 = await res2.json();
    assert.equal(res2.status, 201);
    assert.ok(data2.data?.sale?._id);
    createdSaleIds.push(data2.data.sale._id);

    const savedItem2 = await SaleItem.findOne({ sale: data2.data.sale._id });
    assert.equal(savedItem2.costPrice, 140);
  });

  it("confirms Dashboard's Today's Profit equals the sum of the sale profits returned by /api/sales/profit", async () => {
    // 1. Fetch /api/sales/profit (default = today)
    const profitRes = await fetch(`${baseUrl}/api/sales/profit`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(profitRes.status, 200);
    const profitBody = await profitRes.json();
    assert.ok(profitBody.success);

    const { summary, sales } = profitBody.data;
    assert.ok(summary);
    assert.ok(Array.isArray(sales));

    // Verify each sale has required structure
    for (const sale of sales) {
      assert.ok(sale.saleId);
      assert.ok(sale.invoiceNo);
      assert.ok(sale.date);
      assert.ok(sale.customerName);
      assert.equal(typeof sale.orderDiscount, 'number');
      assert.equal(typeof sale.saleRevenue, 'number');
      assert.equal(typeof sale.saleCost, 'number');
      assert.equal(typeof sale.saleProfit, 'number');
      assert.ok(Array.isArray(sale.items));

      for (const itm of sale.items) {
        assert.ok(itm.productName);
        assert.ok(itm.categoryName);
        assert.equal(typeof itm.qty, 'number');
        assert.equal(typeof itm.sellingPrice, 'number');
        assert.equal(typeof itm.costPrice, 'number');
        assert.equal(typeof itm.lineDiscount, 'number');
        assert.equal(typeof itm.lineRevenue, 'number');
        assert.equal(typeof itm.lineProfit, 'number');
      }
    }

    // Calculate sum of saleProfits from sales array
    const calculatedSumOfSaleProfits = Math.round((sales.reduce((acc, s) => acc + s.saleProfit, 0) + Number.EPSILON) * 100) / 100;
    assert.equal(summary.totalProfit, calculatedSumOfSaleProfits);

    // 2. Fetch Dashboard
    const dashboardRes = await fetch(`${baseUrl}/api/reports/dashboard`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(dashboardRes.status, 200);
    const dashboardBody = await dashboardRes.json();
    assert.ok(dashboardBody.success);

    const todaysProfit = dashboardBody.data.totals.todaysProfit;

    // 3. Confirm Dashboard's Today's Profit EQUALS the sum of sale profits from /api/sales/profit
    assert.equal(todaysProfit, summary.totalProfit);
    assert.equal(todaysProfit, calculatedSumOfSaleProfits);
  });
});
