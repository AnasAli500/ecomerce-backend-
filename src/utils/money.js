function paymentStatus(paid, total) {
  if (paid <= 0) return 'Unpaid';
  if (paid + 0.0001 >= total) return 'Paid';
  return 'Partial';
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

module.exports = { paymentStatus, roundMoney };
