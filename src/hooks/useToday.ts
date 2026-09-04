import { useEffect, useState } from 'react';

export function useToday() {
  const [today, setToday] = useState(() => new Date());

  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 2);
    const timer = setTimeout(() => setToday(new Date()), nextMidnight.getTime() - now.getTime());
    return () => clearTimeout(timer);
  }, [today]);

  return today;
}
