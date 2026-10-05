function parsePagination(query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 10, 1), 100);
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
