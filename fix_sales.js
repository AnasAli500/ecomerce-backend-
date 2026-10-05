// Fix ALL sales where total/debt is wrong due to item discount bug
const { MongoClient } = require('mongodb');

async function main() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('jile_electronics');

  const sales = await db.collection('sales').find({}).toArray();
  let fixed = 0;

  for (const sale of sales) {
    const items = await db.collection('saleitems').find({ sale: sale._id }).toArray();
    if (!items.length) continue;

    // Correct subtotal = sum of lineTotals (each lineTotal already has item discount subtracted)
    let correctSubtotal = 0;
    items.forEach(item => {
      correctSubtotal += item.lineTotal;
    });
    correctSubtotal = Math.round(correctSubtotal * 100) / 100;

    const correctTotal = Math.round(Math.max(correctSubtotal - (sale.discount || 0), 0) * 100) / 100;
    const correctDebt = Math.round(Math.max(correctTotal - sale.paid, 0) * 100) / 100;
    const correctPaid = Math.round(Math.min(sale.paid, correctTotal) * 100) / 100;

    // Only fix if values are wrong
    if (
      Math.abs(sale.subtotal - correctSubtotal) > 0.001 ||
      Math.abs(sale.total - correctTotal) > 0.001 ||
      Math.abs(sale.debt - correctDebt) > 0.001
    ) {
      const oldTotal = sale.total;
      const oldDebt = sale.debt;

      await db.collection('sales').updateOne(
        { _id: sale._id },
        {
          $set: {
            subtotal: correctSubtotal,
            total: correctTotal,
            paid: correctPaid,
            debt: correctDebt,
            paymentStatus: correctDebt <= 0 ? 'Paid' : correctPaid <= 0 ? 'Unpaid' : 'Partial',
          }
        }
      );

      // Fix customer totals
      const diff = oldTotal - correctTotal;
      const debtDiff = oldDebt - correctDebt;
      if (diff !== 0 || debtDiff !== 0) {
        await db.collection('customers').updateOne(
          { _id: sale.customer },
          {
            $inc: {
              totalPurchases: -diff,
              totalDebt: -debtDiff,
            }
          }
        );
      }

      console.log(`Fixed ${sale.invoiceNumber}: total ${oldTotal}->${correctTotal}, debt ${oldDebt}->${correctDebt}`);
      fixed++;
    }
  }

  console.log(`\nDone! Fixed ${fixed} sale(s).`);
  await client.close();
}

main().catch(console.error);
