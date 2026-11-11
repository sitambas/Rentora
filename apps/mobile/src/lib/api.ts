import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import type { ApiErrorBody } from './shared';

const TOKEN_KEY = 'rentora.token';

/**
 * EXPO_PUBLIC_API_URL wins when set. Otherwise, in development, use the computer running `expo start`
 * (its LAN address from the dev server's host URI) on port 4000, so a phone with Expo Go reaches the local API.
 */
function resolveApiUrl() {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host ?? 'localhost'}:4000`;
}
export const API_URL = resolveApiUrl();

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

let token: string | null = null;
export const tokenStore = {
  async load() { token = await SecureStore.getItemAsync(TOKEN_KEY); return token; },
  async set(t: string | null) {
    token = t;
    if (t) await SecureStore.setItemAsync(TOKEN_KEY, t); else await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
};

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
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
    throw new ApiError(0, `Could not reach the Rentora server at ${API_URL}. Check your connection and that the API is running.`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized?.();
    throw new ApiError(res.status, (data as ApiErrorBody).error ?? `Request failed (${res.status}).`);
  }
  return data as T;
}
