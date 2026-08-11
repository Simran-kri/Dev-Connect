// Simple prev/next pagination bar shared by any paginated list (Feed,
// Projects, Network). The backend returns { page, totalPages, hasMore }
// on every paginated endpoint, so this component just renders that state.
export default function Pagination({ page, totalPages, onChange, loading }) {
  if (totalPages <= 1) return null;

  return (
    <div className="pagination">
      <button
        type="button"
        className="secondary"
        disabled={loading || page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </button>
      <span>Page {page} of {totalPages}</span>
      <button
        type="button"
        className="secondary"
        disabled={loading || page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Next
      </button>
    </div>
  );
}
