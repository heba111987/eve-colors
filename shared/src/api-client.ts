import type { QuestionRef, SessionUser, TaskRef, TimelineEntry, TodayEntry } from './types';

export interface ApiClientConfig {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  requestInit?: RequestInit;
  onUnauthorized?: () => void;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function createApiClient(config: ApiClientConfig) {
  const fetchImpl = config.fetchImpl ?? fetch;

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetchImpl(`${config.baseUrl}${path}`, {
      ...config.requestInit,
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(config.requestInit?.headers ?? {}),
        ...(init.headers ?? {}),
      },
    });

    if (response.status === 401) {
      config.onUnauthorized?.();
      throw new ApiError(401, 'unauthorized');
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({}) as { error?: string });
      throw new ApiError(response.status, body.error ?? `Request failed: ${response.status}`);
    }
    if (response.status === 204) return undefined as T;
    return response.json();
  }

  return {
    getMe: () => request<{ user: SessionUser }>('/api/me'),
    postConsent: (analyticsMarketing: boolean) =>
      request<{ ok: true }>('/api/me/consent', {
        method: 'POST',
        body: JSON.stringify({ analyticsMarketing }),
      }),
    deleteMe: () => request<{ ok: true }>('/api/me', { method: 'DELETE' }),
    getToday: () => request<{ entry: TodayEntry | null }>('/api/today'),
    createEntry: (color: string) =>
      request<{ entry: { id: string; color: string; entryDate: string; question: QuestionRef } }>('/api/entries', {
        method: 'POST',
        body: JSON.stringify({ color }),
      }),
    answerEntry: (entryId: string, answer: string) =>
      request<{ entry: { task: TaskRef } }>(`/api/entries/${entryId}`, {
        method: 'PATCH',
        body: JSON.stringify({ answer }),
      }),
    completeTask: (entryId: string) =>
      request<{ entry: unknown }>(`/api/entries/${entryId}`, {
        method: 'PATCH',
        body: JSON.stringify({ taskCompleted: true }),
      }),
    rerollTask: (entryId: string) =>
      request<{ task: TaskRef }>(`/api/entries/${entryId}/reroll-task`, { method: 'POST' }),
    listEntries: (cursor?: string | null) =>
      request<{ entries: TimelineEntry[]; nextCursor: string | null }>(
        `/api/entries${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
      ),
    deleteEntry: (entryId: string) => request<{ ok: true }>(`/api/entries/${entryId}`, { method: 'DELETE' }),
    logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),
    googleStartUrl: () => `${config.baseUrl}/auth/google/start`,
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
