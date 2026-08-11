const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;

// Reads ?page= and ?limit= off the query string, clamps them to sane
// bounds, and returns everything a route needs to run a paginated query.
export function parsePagination(query, defaultLimit = DEFAULT_LIMIT) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

// Shapes the response consistently across every paginated list endpoint:
// { items, page, limit, total, totalPages, hasMore }
export function buildPage(items, total, page, limit) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    items,
    page,
    limit,
    total,
    totalPages,
    hasMore: page < totalPages
  };
}
