const { roundMoney } = require('./money');

/**
 * Calculates profit and revenue breakdown for a single sale.
 *
 * Formulas:
 *   lineProfit = (sellingPrice - costPrice) * qty - lineDiscount
 *   saleProfit = sum(lineProfit) - orderDiscount
 *   saleRevenue = sum(sellingPrice * qty - lineDiscount) - orderDiscount
 *   saleCost = sum(costPrice * qty)
 *
 * All amounts are rounded to 2 decimal places.
 */
function calculateSaleProfit(sale) {
  const orderDiscount = roundMoney(Number(sale.discount ?? sale.orderDiscount ?? 0));
  const rawItems = sale.items || [];

  let lineProfitsSum = 0;
  let lineRevenuesSum = 0;
  let totalCostSum = 0;

  const items = rawItems.map((item) => {
    const qty = Number(item.quantity ?? item.qty ?? 0);
    const sellingPrice = Number(item.sellingPrice ?? 0);

    // Fall back to product's current costPrice / purchasePrice if costPrice was not snapshotted
    const costPrice = Number(
      item.costPrice !== undefined && item.costPrice !== null
        ? item.costPrice
        : (item.purchasePrice !== undefined && item.purchasePrice !== null
            ? item.purchasePrice
            : (item.product?.costPrice ?? item.product?.purchasePrice ?? 0))
    );

    const lineDiscount = Number(item.discount ?? item.lineDiscount ?? 0);

    const lineRevenue = roundMoney(sellingPrice * qty - lineDiscount);
    const lineCost = roundMoney(costPrice * qty);
    const lineProfit = roundMoney((sellingPrice - costPrice) * qty - lineDiscount);

    lineProfitsSum += lineProfit;
    lineRevenuesSum += (sellingPrice * qty - lineDiscount);
    totalCostSum += lineCost;

    let categoryName = 'Uncategorized';
    if (item.categoryName) {
      categoryName = item.categoryName;
    } else if (item.product && typeof item.product === 'object') {
      if (typeof item.product.category === 'object' && item.product.category?.name) {
        categoryName = item.product.category.name;
      } else if (typeof item.product.category === 'string') {
        categoryName = item.product.category;
      }
    }

    return {
      productName: item.productName || item.product?.name || 'Unknown Product',
      categoryName: categoryName || 'Uncategorized',
      qty,
      sellingPrice: roundMoney(sellingPrice),
      costPrice: roundMoney(costPrice),
      lineDiscount: roundMoney(lineDiscount),
      lineRevenue,
      lineProfit,
    };
  });

  const saleRevenue = roundMoney(lineRevenuesSum - orderDiscount);
  const saleCost = roundMoney(totalCostSum);
  const saleProfit = roundMoney(lineProfitsSum - orderDiscount);

  return {
    saleId: sale._id ? String(sale._id) : (sale.saleId || ''),
    invoiceNo: sale.invoiceNumber || sale.invoiceNo || '',
    date: sale.date || sale.createdAt,
    customerName: (typeof sale.customer === 'object' && sale.customer?.name)
      ? sale.customer.name
      : (sale.customerName || (typeof sale.customer === 'string' ? sale.customer : 'Normal Customer')),
    orderDiscount,
    saleRevenue,
    saleCost,
    saleProfit,
    items,
  };
}

/**
 * Calculates profit summary and sale details across an array of sales.
 */
function calculateSalesProfit(sales = []) {
  let totalRevenue = 0;
  let totalCost = 0;
  let totalProfit = 0;

  const processedSales = sales.map((sale) => {
    const computed = calculateSaleProfit(sale);
    totalRevenue += computed.saleRevenue;
    totalCost += computed.saleCost;
    totalProfit += computed.saleProfit;
    return computed;
  });

  return {
    summary: {
      totalRevenue: roundMoney(totalRevenue),
      totalCost: roundMoney(totalCost),
      totalProfit: roundMoney(totalProfit),
      salesCount: sales.length,
    },
    sales: processedSales,
  };
}

module.exports = {
  calculateSaleProfit,
  calculateSalesProfit,
};
