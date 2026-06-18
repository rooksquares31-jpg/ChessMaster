/**
 * Parse page/limit from query params and return Mongoose-ready options
 * plus metadata for the response.
 *
 * Usage:
 *   const { skip, limit, meta } = paginate(req.query, totalCount);
 */
const paginate = (query = {}, totalCount = 0) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;
  const totalPages = Math.ceil(totalCount / limit);

  return {
    skip,
    limit,
    meta: {
      page,
      limit,
      totalCount,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
};

module.exports = { paginate };
