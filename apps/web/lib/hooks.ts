'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

/** Fetches a GET endpoint and keeps the result; `reload` refetches without clearing what is on screen. */
export function useQuery<T>(path: string | null, opts: { pollMs?: number } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  const live = useRef(true);

  const reload = useCallback(async () => {
    if (!path) return;
    try {
      const d = await api<T>(path);
      if (live.current) { setData(d); setError(null); }
    } catch (e) {
      if (live.current) setError((e as Error).message);
    } finally {
      if (live.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    live.current = true;
    setLoading(!!path);
    reload();
    const t = opts.pollMs ? setInterval(reload, opts.pollMs) : null;
    return () => { live.current = false; if (t) clearInterval(t); };
  }, [reload, opts.pollMs, path]);

  return { data, error, loading, reload, setData };
}

/** Wraps a mutation: tracks busy state and turns thrown errors into a message. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const run = useCallback(async <R,>(fn: () => Promise<R>, onError?: (msg: string) => void): Promise<R | undefined> => {
    setBusy(true);
    try { return await fn(); }
    catch (e) { onError?.((e as Error).message); return undefined; }
    finally { setBusy(false); }
  }, []);
  return { busy, run };
}
