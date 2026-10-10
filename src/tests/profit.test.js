const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { calculateSaleProfit, calculateSalesProfit } = require('../utils/profit');

describe('Shared Profit Calculation Helper', () => {
  it('(a) calculates profit for a normal sale without discounts', () => {
    const sale = {
      _id: 'sale-1',
      invoiceNumber: 'SALE-0001',
      date: new Date('2026-10-11T10:00:00Z'),
      customer: { name: 'Alice Smith' },
      discount: 0,
      items: [
        {
          productName: 'Mechanical Keyboard',
          categoryName: 'Peripherals',
          quantity: 2,
          sellingPrice: 100,
          costPrice: 60,
          discount: 0,
        },
        {
          productName: 'Gaming Mouse',
          categoryName: 'Peripherals',
          quantity: 1,
          sellingPrice: 50,
          costPrice: 30,
          discount: 0,
        },
      ],
    };

    const result = calculateSaleProfit(sale);

    // Line 1: (100 - 60) * 2 - 0 = 80, revenue = 200
    assert.equal(result.items[0].lineProfit, 80);
    assert.equal(result.items[0].lineRevenue, 200);
    assert.equal(result.items[0].costPrice, 60);

    // Line 2: (50 - 30) * 1 - 0 = 20, revenue = 50
    assert.equal(result.items[1].lineProfit, 20);
    assert.equal(result.items[1].lineRevenue, 50);
    assert.equal(result.items[1].costPrice, 30);

    // Sale totals:
    // saleRevenue = (200 + 50) - 0 = 250
    // saleCost = (60 * 2) + (30 * 1) = 150
    // saleProfit = 80 + 20 - 0 = 100
    assert.equal(result.saleRevenue, 250);
    assert.equal(result.saleCost, 150);
    assert.equal(result.saleProfit, 100);
    assert.equal(result.customerName, 'Alice Smith');
    assert.equal(result.invoiceNo, 'SALE-0001');
  });

  it('(b) calculates profit for a sale with line discounts and an order discount', () => {
    const sale = {
      _id: 'sale-2',
      invoiceNumber: 'SALE-0002',
      date: new Date('2026-10-11T11:00:00Z'),
      customer: { name: 'Bob Johnson' },
      discount: 15, // orderDiscount
      items: [
        {
          productName: '4K Monitor',
          categoryName: 'Displays',
          quantity: 3,
          sellingPrice: 120,
          costPrice: 70,
          discount: 20, // lineDiscount
        },
        {
          productName: 'HDMI Cable',
          categoryName: 'Accessories',
          quantity: 2,
          sellingPrice: 40,
          costPrice: 25,
          discount: 5, // lineDiscount
        },
      ],
    };

    const result = calculateSaleProfit(sale);

    // Line 1: lineProfit = (120 - 70) * 3 - 20 = 150 - 20 = 130
    // Line 1: lineRevenue = (120 * 3) - 20 = 340
    assert.equal(result.items[0].lineProfit, 130);
    assert.equal(result.items[0].lineRevenue, 340);

    // Line 2: lineProfit = (40 - 25) * 2 - 5 = 30 - 5 = 25
    // Line 2: lineRevenue = (40 * 2) - 5 = 75
    assert.equal(result.items[1].lineProfit, 25);
    assert.equal(result.items[1].lineRevenue, 75);

    // Sale revenue: (340 + 75) - 15 = 400
    // Sale cost: (70 * 3) + (25 * 2) = 210 + 50 = 260
    // Sale profit: (130 + 25) - 15 = 140
    assert.equal(result.saleRevenue, 400);
    assert.equal(result.saleCost, 260);
    assert.equal(result.saleProfit, 140);
    assert.equal(result.orderDiscount, 15);
  });

  it('(c) calculates loss when cost is higher than selling price', () => {
    const sale = {
      _id: 'sale-3',
      invoiceNumber: 'SALE-0003',
      date: new Date('2026-10-11T12:00:00Z'),
      customer: { name: 'Charlie Brown' },
      discount: 10, // orderDiscount
      items: [
        {
          productName: 'Clearance Laptop',
          categoryName: 'Computers',
          quantity: 2,
          sellingPrice: 50,
          costPrice: 80, // cost is higher than selling price
          discount: 0,
        },
      ],
    };

    const result = calculateSaleProfit(sale);

    // Line 1: lineProfit = (50 - 80) * 2 - 0 = -60
    // Line 1: lineRevenue = 50 * 2 = 100
    assert.equal(result.items[0].lineProfit, -60);
    assert.equal(result.items[0].lineRevenue, 100);

    // Sale revenue: 100 - 10 = 90
    // Sale cost: 80 * 2 = 160
    // Sale profit: -60 - 10 = -70 (negative profit = loss)
    assert.equal(result.saleRevenue, 90);
    assert.equal(result.saleCost, 160);
    assert.equal(result.saleProfit, -70);
  });

  it('falls back to populated product costPrice / purchasePrice if snapshot is missing', () => {
    const legacySale = {
      _id: 'legacy-1',
      invoiceNumber: 'SALE-LEGACY',
      date: new Date('2026-10-11T09:00:00Z'),
      customer: { name: 'Legacy Customer' },
      discount: 0,
      items: [
        {
          productName: 'Legacy Item',
          quantity: 1,
          sellingPrice: 100,
          // costPrice and purchasePrice not set on item, but product has costPrice
          product: {
            name: 'Legacy Item',
            costPrice: 65,
            purchasePrice: 65,
            category: { name: 'Legacy Category' },
          },
          discount: 0,
        },
      ],
    };

    const result = calculateSaleProfit(legacySale);
    assert.equal(result.items[0].costPrice, 65);
    assert.equal(result.items[0].lineProfit, 35);
    assert.equal(result.saleProfit, 35);
  });

  it('correctly aggregates multiple sales in calculateSalesProfit', () => {
    const sales = [
      {
        _id: 's1',
        invoiceNumber: 'INV-1',
        discount: 0,
        items: [
          { productName: 'A', quantity: 1, sellingPrice: 100, costPrice: 60, discount: 0 },
        ],
      },
      {
        _id: 's2',
        invoiceNumber: 'INV-2',
        discount: 5,
        items: [
          { productName: 'B', quantity: 2, sellingPrice: 50, costPrice: 30, discount: 5 },
        ],
      },
    ];

    const result = calculateSalesProfit(sales);

    // Sale 1: rev = 100, cost = 60, profit = 40
    // Sale 2: rev = (100 - 5) - 5 = 90, cost = 60, profit = (40 - 5) - 5 = 30
    assert.equal(result.summary.salesCount, 2);
    assert.equal(result.summary.totalRevenue, 190);
    assert.equal(result.summary.totalCost, 120);
    assert.equal(result.summary.totalProfit, 70);
  });
});
