import type { ApiErrorBody, TenantDocument } from '@rentora/shared';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const TOKEN_KEY = 'rentora.token';

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export const tokenStore = {
  get(): string | null {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set(t: string | null) {
    try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* storage blocked */ }
  }
};

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = tokenStore.get();
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method: opts.method ?? (opts.body === undefined ? 'GET' : 'POST'),
      headers: {
        ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {})
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body)
    });
  } catch {
    throw new ApiError(0, 'Could not reach the Rentora server. Check your connection and try again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized?.();
    throw new ApiError(res.status, (data as ApiErrorBody).error ?? `Request failed (${res.status}).`);
  }
  return data as T;
}

/** Uploads one file as a lease document. */
export async function uploadDocument(leaseId: string, kind: string, file: File): Promise<TenantDocument> {
  const token = tokenStore.get();
  const qs = new URLSearchParams({ leaseId, kind, name: file.name });
  let res: Response;
  try {
    res = await fetch(`${API_URL}/documents?${qs}`, {
      method: 'POST',
      headers: { 'content-type': file.type || 'application/octet-stream', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: file
    });
  } catch {
    throw new ApiError(0, 'Could not reach the Rentora server. Check your connection and try again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized?.();
    throw new ApiError(res.status, (data as ApiErrorBody).error ?? `Upload failed (${res.status}).`);
  }
  return data as TenantDocument;
}

/** Opens a lease document in a new tab. The file needs the sign-in token, so it is fetched first. */
export async function openDocument(id: string, fileName: string) {
  // Open the tab straight away so pop-up blockers allow it, then point it at the file.
  const tab = window.open('', '_blank');
  try {
    const token = tokenStore.get();
    const res = await fetch(`${API_URL}/documents/${id}/file`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new ApiError(res.status, (data as ApiErrorBody).error ?? 'Could not open the file.');
    }
    const url = URL.createObjectURL(await res.blob());
    if (tab) tab.location.href = url;
    else {
      // Pop-ups are blocked: download the file instead.
      const link = Object.assign(document.createElement('a'), { href: url, download: fileName });
      document.body.appendChild(link); link.click(); link.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    tab?.close();
    throw e;
  }
}
