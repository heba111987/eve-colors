import { afterEach, describe, expect, it, vi } from 'vitest';
import { deletePostHogPerson } from '../../src/lib/posthog';

const env = { POSTHOG_PROJECT_ID: 'proj-1', POSTHOG_DELETION_API_KEY: 'key-1' };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('deletePostHogPerson', () => {
  it('looks up the person by distinct_id and deletes each match', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [{ id: 'person-1' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await deletePostHogPerson(env, 'user@example.com');

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('distinct_id=user%40example.com'),
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/persons/person-1/'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('does nothing when no person is found', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 })),
    );
    await expect(deletePostHogPerson(env, 'nobody@example.com')).resolves.toBeUndefined();
  });

  it('throws when the lookup request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('error', { status: 500 })));
    await expect(deletePostHogPerson(env, 'user@example.com')).rejects.toThrow();
  });
});
