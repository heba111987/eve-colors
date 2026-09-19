import { describe, expect, it } from 'vitest';
import { env, createExecutionContext } from 'cloudflare:test';
import app from '../src/index';
import { createSession, sessionCookie } from '../src/lib/session';

describe('assembled app', () => {
  it('routes /auth/google/start', async () => {
    const res = await app.request('/auth/google/start', {}, env, createExecutionContext());
    expect(res.status).toBe(302);
  });

  it('routes GET /api/today for a signed-in user with no entry yet', async () => {
    const now = new Date().toISOString();
    await env.DB
      .prepare(`INSERT INTO users (id, google_sub, email, created_at, last_login_at) VALUES ('u1','s1','u1@example.com', ?, ?)`)
      .bind(now, now)
      .run();
    const session = await createSession(env.DB, 'u1');
    const cookie = sessionCookie(session.id, 'localhost', session.expiresAt).split(';')[0];

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
