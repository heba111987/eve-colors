import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from '../src/api-client';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createApiClient', () => {
  it('calls getMe against the configured base URL with merged request init', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ user: { id: 'u1' } }), { status: 200 }));
    const client = createApiClient({
      baseUrl: 'http://api.test',
      fetchImpl: fetchMock,
      requestInit: { credentials: 'include' },
    });

    const result = await client.getMe();
    expect(result.user.id).toBe('u1');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/api/me',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('throws ApiError and calls onUnauthorized on a 401', async () => {
    const onUnauthorized = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    const client = createApiClient({ baseUrl: 'http://api.test', fetchImpl: fetchMock, onUnauthorized });

    await expect(client.getMe()).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalled();
  });

  it('throws ApiError with the server error message on a non-2xx response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ error: 'entry_already_exists_today' }), { status: 409 }));
    const client = createApiClient({ baseUrl: 'http://api.test', fetchImpl: fetchMock });

    await expect(client.createEntry('Teal')).rejects.toThrow('entry_already_exists_today');
  });

  it('sends an Authorization header when configured, for a bearer-token (mobile-style) caller', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const client = createApiClient({
      baseUrl: 'http://api.test',
      fetchImpl: fetchMock,
      requestInit: { headers: { Authorization: 'Bearer token-123' } },
    });

    await client.deleteMe();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/api/me',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token-123' }) }),
    );
  });
});
