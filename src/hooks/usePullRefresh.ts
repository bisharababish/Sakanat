import { useCallback, useRef, useState } from 'react';

const MIN_SPINNER_MS = 500;

export function usePullRefresh(load: () => Promise<void>) {
  const [refreshing, setRefreshing] = useState(false);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setRefreshing(true);
    const started = Date.now();
    try {
      await load();
    } finally {
      const wait = MIN_SPINNER_MS - (Date.now() - started);
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      setRefreshing(false);
      busy.current = false;
    }
  }, [load]);

  return { refreshing, refresh };
}
