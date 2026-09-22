import { API_URL } from './config';

let csrfReady: Promise<void> | null = null;

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

async function ensureCsrfCookie(): Promise<void> {
  if (!csrfReady) {
    csrfReady = fetch(`${API_URL}/sanctum/csrf-cookie`, { credentials: 'include' }).then(() => undefined);
  }
  await csrfReady;
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

type JsonBody = Record<string, unknown>;

async function request<T>(method: string, path: string, body?: JsonBody): Promise<T> {
  const isMutating = method !== 'GET';
  if (isMutating) {
    await ensureCsrfCookie();
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (isMutating) {
    const token = getCookie('XSRF-TOKEN');
    if (token) headers['X-XSRF-TOKEN'] = token;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    credentials: 'include',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const contentType = response.headers.get('content-type') ?? '';
  const data = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    const message = (data as { error?: string } | null)?.error ?? response.statusText;
    throw new ApiError(response.status, data, message);
  }

  return data as T;
}

// NOTE: this wrapper is the single seam where a future native build adds
// `Authorization: Bearer <token>` auth — every screen calls apiClient.*,
// never fetch() directly, so that change happens in exactly one place.
export const apiClient = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: JsonBody) => request<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body?: JsonBody) => request<T>('PATCH', path, body ?? {}),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
