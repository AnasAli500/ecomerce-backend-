function success(res, data = {}, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

function paginated(res, items, meta, message = 'Success') {
  return res.status(200).json({
    success: true,
    message,
    data: items,
    meta,
  });
}

module.exports = { success, paginated };
