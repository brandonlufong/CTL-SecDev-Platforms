import React from 'react';
import { Pagination, Form } from 'react-bootstrap';

/**
 * Pagination that matches the Server Assets page (Bootstrap Pagination with
 * First/Prev/windowed items/Next/Last + a "Showing X to Y of Z" summary) PLUS
 * the same "5 / 10 / 25 / 50 / 100 per page" selector Servers uses. Pass
 * onPageSizeChange to enable the selector. Used across every paged table so
 * they all feel identical.
 */
export default function BsPagination({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 25, 50, 100],
  label = 'items',
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      let startPage = Math.max(2, currentPage - 1);
      let endPage = Math.min(totalPages - 1, currentPage + 1);
      if (currentPage <= 3) endPage = 4;
      else if (currentPage >= totalPages - 2) startPage = totalPages - 3;
      if (startPage > 2) pages.push('...');
      for (let i = startPage; i <= endPage; i++) pages.push(i);
      if (endPage < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  if (totalItems === 0) return null;

  return (
    <div className="d-flex flex-column flex-md-row justify-content-between align-items-center mt-3 gap-3">
      <div className="d-flex align-items-center gap-2 text-muted flex-wrap">
        <span>
          Showing <strong>{Math.min(indexOfFirst + 1, totalItems)}</strong> to{' '}
          <strong>{Math.min(indexOfLast, totalItems)}</strong> of{' '}
          <strong>{totalItems}</strong> {label}
        </span>
        {onPageSizeChange && (
          <Form.Select
            size="sm"
            value={itemsPerPage}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            style={{ maxWidth: '120px' }}
            aria-label="Rows per page"
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>{n} per page</option>
            ))}
          </Form.Select>
        )}
      </div>

      {totalPages > 1 && (
        <Pagination className="mb-0">
          <Pagination.First disabled={currentPage === 1} onClick={() => onPageChange(1)} title="First Page" />
          <Pagination.Prev disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)} title="Previous Page" />
          {getPageNumbers().map((page, index) =>
            page === '...' ? (
              <Pagination.Ellipsis key={`ellipsis-${index}`} disabled />
            ) : (
              <Pagination.Item key={page} active={page === currentPage} onClick={() => onPageChange(page)}>
                {page}
              </Pagination.Item>
            )
          )}
          <Pagination.Next disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)} title="Next Page" />
          <Pagination.Last disabled={currentPage === totalPages} onClick={() => onPageChange(totalPages)} title="Last Page" />
        </Pagination>
      )}
    </div>
  );
}
