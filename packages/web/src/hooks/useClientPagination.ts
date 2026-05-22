'use client';

import { useEffect, useMemo, useState } from 'react';

export function useClientPagination<T>(items: T[], pageSize = 12) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [items.length, pageSize]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  const rangeStart = items.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, items.length);

  return {
    page,
    setPage,
    pageItems,
    totalPages,
    rangeStart,
    rangeEnd,
    total: items.length,
    showPager: items.length > pageSize,
  };
}
