export const buildPagination = (page = 1, perPage = 10) => {
  const limit = Number(perPage) > 0 ? Number(perPage) : 10;
  const currentPage = Number(page) > 0 ? Number(page) : 1;
  const offset = (currentPage - 1) * limit;

  return { limit, offset, currentPage };
};

export const buildMeta = ({ count, limit, currentPage }) => {
  const totalResults = count;
  const totalPages = Math.ceil(totalResults / limit) || 1;

  return {
    total_results: totalResults,
    total_pages: totalPages,
    current_page: currentPage,
    per_page: limit,
  };
};

