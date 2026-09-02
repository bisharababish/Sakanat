import { useEffect, useState } from 'react';

import { paginate } from '@/src/lib/page';

export function usePaged<T>(items: T[], size: number, resetKey: string) {
  const [page, setPage] = useState(0);
  useEffect(() => {
    setPage(0);
  }, [resetKey]);
  const next = paginate(items, page, size);
  return { ...next, page: next.current, setPage, pageSize: size };
}
