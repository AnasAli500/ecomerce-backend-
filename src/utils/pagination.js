function parsePagination(query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  let limit = 10;
  if (query.limit === 'all' || query.limit === 'All' || query.limit === '0') {
    limit = 100000;
  } else if (query.limit !== undefined && query.limit !== null && query.limit !== '') {
    const parsed = parseInt(query.limit, 10);
    if (!isNaN(parsed) && parsed > 0) {
      limit = Math.min(parsed, 100000);
    }
  }
  const skip = (page - 1) * limit;
  const sortField = query.sort || 'createdAt';
  const sortOrder = query.order === 'asc' ? 1 : -1;
  return { page, limit, skip, sort: { [sortField]: sortOrder } };
}

function paginationMeta(total, page, limit) {
  return {
    total,
    page,
    limit,
    pages: Math.ceil(total / limit) || 1,
  };
}

module.exports = { parsePagination, paginationMeta };
