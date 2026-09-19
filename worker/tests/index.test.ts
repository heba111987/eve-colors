import { describe, expect, it, vi, afterEach } from 'vitest';
import { env, createExecutionContext } from 'cloudflare:test';
import app from '../src/index';
import { createSession, sessionCookie } from '../src/lib/session';

async function seedSignedInUser(id: string, consentAcceptedAt: string | null) {
  const now = new Date().toISOString();
  await env.DB
    .prepare(
      `INSERT INTO users (id, google_sub, email, consent_accepted_at, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, `sub-${id}`, `${id}@example.com`, consentAcceptedAt, now, now)
    .run();
  const session = await createSession(env.DB, id);
  return sessionCookie(session.id, 'localhost', session.expiresAt).split(';')[0];
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('assembled app', () => {
  it('routes /auth/google/start', async () => {
    const res = await app.request('/auth/google/start', {}, env, createExecutionContext());
    expect(res.status).toBe(302);
  });

  it('routes GET /api/today for a signed-in, consented user with no entry yet', async () => {
    const cookie = await seedSignedInUser('u1', new Date().toISOString());

    const res = await app.request('/api/today', { headers: { Cookie: cookie } }, env, createExecutionContext());
    expect(res.status).toBe(200);
    const body = await res.json<{ entry: null }>();
    expect(body.entry).toBeNull();
  });

  it('routes /api/entries', async () => {
    const res = await app.request('/api/entries', {}, env, createExecutionContext());
    expect(res.status).toBe(401);
  });
});

describe('required consent is enforced server-side', () => {
  it('blocks GET /api/today with 403 consent_required until consent is recorded', async () => {
    const cookie = await seedSignedInUser('u-nc', null);

    const blocked = await app.request('/api/today', { headers: { Cookie: cookie } }, env, createExecutionContext());
    expect(blocked.status).toBe(403);
    expect(await blocked.json()).toEqual({ error: 'consent_required' });

    // POST /api/me/consent is how a user consents, so it must stay reachable.
    const consented = await app.request(
      '/api/me/consent',
      { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({}) },
      env,
      createExecutionContext(),
    );
    expect(consented.status).toBe(200);

    // ...and afterwards the same request goes through.
    const allowed = await app.request('/api/today', { headers: { Cookie: cookie } }, env, createExecutionContext());
    expect(allowed.status).toBe(200);
  });

  it('blocks POST /api/entries with 403 consent_required through the assembled app', async () => {
    const cookie = await seedSignedInUser('u-nc2', null);
    const res = await app.request(
      '/api/entries',
      {
        method: 'POST',
        headers: { Cookie: cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ color: 'Teal' }),
      },
      env,
      createExecutionContext(),
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'consent_required' });
  });

  it('keeps GET /api/me working for a user who has not consented', async () => {
    const cookie = await seedSignedInUser('u-nc3', null);
    const res = await app.request('/api/me', { headers: { Cookie: cookie } }, env, createExecutionContext());
    expect(res.status).toBe(200);
    const body = await res.json<{ user: { consentAcceptedAt: string | null } }>();
    expect(body.user.consentAcceptedAt).toBeNull();
  });

  it('keeps DELETE /api/me working for a user who has not consented', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 })),
    );
    const cookie = await seedSignedInUser('u-nc4', null);

    const res = await app.request(
      '/api/me',
      { method: 'DELETE', headers: { Cookie: cookie } },
      env,
      createExecutionContext(),
    );
    expect(res.status).toBe(200);

    const row = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind('u-nc4').first();
    expect(row).toBeNull();
  });
});
