function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfWeek(date = new Date()) {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d;
}

function startOfMonth(date = new Date()) {
  const d = startOfDay(date);
  d.setDate(1);
  return d;
}

function startOfYear(date = new Date()) {
  const d = startOfDay(date);
  d.setMonth(0, 1);
  return d;
}

function resolvePeriod(query) {
  const now = new Date();
  const period = query.period || query.range;

  if (query.from && query.to) {
    return { from: startOfDay(new Date(query.from)), to: endOfDay(new Date(query.to)) };
  }

  switch (period) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'week':
    case 'thisWeek':
      return { from: startOfWeek(now), to: endOfDay(now) };
    case 'month':
    case 'thisMonth':
      return { from: startOfMonth(now), to: endOfDay(now) };
    case 'year':
    case 'thisYear':
      return { from: startOfYear(now), to: endOfDay(now) };
    default:
      return null;
  }
}

module.exports = {
  startOfDay,
  endOfDay,
  startOfWeek,
  startOfMonth,
  startOfYear,
  resolvePeriod,
};
