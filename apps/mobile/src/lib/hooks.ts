import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { api } from './api';

/** Fetches a GET endpoint, refetches whenever the screen regains focus, and optionally polls. */
export function useQuery<T>(path: string | null, opts: { pollMs?: number } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const live = useRef(true);

  const reload = useCallback(async () => {
    if (!path) return;
    try {
      const d = await api<T>(path);
      if (live.current) { setData(d); setError(null); }
    } catch (e) {
      if (live.current) setError((e as Error).message);
    }
  }, [path]);

  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  useFocusEffect(useCallback(() => {
    reload();
    if (!opts.pollMs) return;
    const t = setInterval(reload, opts.pollMs);
    return () => clearInterval(t);
  }, [reload, opts.pollMs]));

  const refresh = useCallback(async () => { setRefreshing(true); await reload(); setRefreshing(false); }, [reload]);
  return { data, error, reload, refresh, refreshing, setData };
}
