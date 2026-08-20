import React from 'react';
import '../styles/theme.css';

/**
 * Compact, brand-styled pagination used across the modernized tables.
 * Shows first/prev/window/next/last plus a page-size selector and a summary.
 */
export default function VmPagination({ page, pageSize, total, onPage, onPageSize, pageSizes = [10, 25, 50, 100] }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clamp = (p) => Math.min(totalPages, Math.max(1, p));
  const go = (p) => onPage(clamp(p));

  // Windowed page numbers around the current page.
  const nums = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + 4);
  for (let i = Math.max(1, end - 4); i <= end; i++) nums.push(i);

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  if (total === 0) return null;

  return (
    <div className="vm-pager">
      <div className="vm-pager-info">
        Showing <strong>{from}–{to}</strong> of <strong>{total}</strong>
        {onPageSize && (
          <select className="vm-pager-size" value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))}>
            {pageSizes.map((s) => <option key={s} value={s}>{s} / page</option>)}
          </select>
        )}
      </div>
      <div className="vm-pager-btns">
        <button className="vm-pager-btn" disabled={page <= 1} onClick={() => go(1)}>«</button>
        <button className="vm-pager-btn" disabled={page <= 1} onClick={() => go(page - 1)}>‹</button>
        {nums[0] > 1 && <span className="vm-pager-ellipsis">…</span>}
        {nums.map((n) => (
          <button key={n} className={`vm-pager-btn ${n === page ? 'active' : ''}`} onClick={() => go(n)}>{n}</button>
        ))}
        {nums[nums.length - 1] < totalPages && <span className="vm-pager-ellipsis">…</span>}
        <button className="vm-pager-btn" disabled={page >= totalPages} onClick={() => go(page + 1)}>›</button>
        <button className="vm-pager-btn" disabled={page >= totalPages} onClick={() => go(totalPages)}>»</button>
      </div>
    </div>
  );
}
