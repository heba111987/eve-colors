import { describe, expect, it, vi, afterEach } from 'vitest';
import { env, createExecutionContext } from 'cloudflare:test';
import { Hono } from 'hono';
import { authRoutes } from '../../src/routes/auth';
import { createSession } from '../../src/lib/session';
import type { Env } from '../../src/types';

function buildApp() {
  const app = new Hono<{ Bindings: Env }>();
  app.route('/auth', authRoutes);
  return app;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /auth/google/start', () => {
  it('redirects to Google and sets a state cookie', async () => {
    const app = buildApp();
    const res = await app.request('/auth/google/start', {}, env, createExecutionContext());
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('accounts.google.com');
    expect(res.headers.get('Set-Cookie')).toContain('eve_oauth_state=');
  });
});

describe('GET /auth/google/callback', () => {
  it('rejects when state does not match the cookie', async () => {
    const app = buildApp();
    const res = await app.request(
      '/auth/google/callback?code=abc&state=mismatched',
      { headers: { Cookie: 'eve_oauth_state=different' } },
      env,
      createExecutionContext(),
    );
    expect(res.status).toBe(400);
  });

  function stubGoogleFetch(userInfo: Record<string, unknown>) {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        // '/tokeninfo' must be checked before '/token' — it contains '/token' as a
        // substring, so a naive `.includes('/token')` check would misroute both
        // calls to the token-exchange branch.
        if (url.includes('/tokeninfo')) {
          return Promise.resolve(new Response(JSON.stringify(userInfo)));
        }
        return Promise.resolve(
          new Response(JSON.stringify({ access_token: 'a', id_token: 'id-1', expires_in: 3600, token_type: 'Bearer' })),
        );
      }),
    );
  }

  it('creates a new user, session, and redirects to /consent on first login', async () => {
    stubGoogleFetch({
      sub: 'google-sub-1',
      email: 'new-user@example.com',
      email_verified: true,
      aud: env.GOOGLE_CLIENT_ID,
      name: 'New User',
    });

    const app = buildApp();
    const res = await app.request(
      '/auth/google/callback?code=abc&state=same',
      { headers: { Cookie: 'eve_oauth_state=same' } },
      env,
      createExecutionContext(),
    );

    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe(`${env.FRONTEND_BASE_URL}/consent`);
    expect(res.headers.get('Set-Cookie')).toContain('eve_session=');

    const user = await env.DB
      .prepare('SELECT email FROM users WHERE google_sub = ?')
      .bind('google-sub-1')
      .first<{ email: string }>();
    expect(user?.email).toBe('new-user@example.com');
  });

  it('redirects a repeat login straight to /today', async () => {
    stubGoogleFetch({
      sub: 'google-sub-2',
      email: 'repeat-user@example.com',
      email_verified: true,
      aud: env.GOOGLE_CLIENT_ID,
      name: 'Repeat User',
    });
    const app = buildApp();

    await app.request(
      '/auth/google/callback?code=abc&state=same',
      { headers: { Cookie: 'eve_oauth_state=same' } },
      env,
      createExecutionContext(),
    );
    const second = await app.request(
      '/auth/google/callback?code=abc&state=same',
      { headers: { Cookie: 'eve_oauth_state=same' } },
      env,
      createExecutionContext(),
    );

    expect(second.headers.get('Location')).toBe(`${env.FRONTEND_BASE_URL}/today`);
  });
});

describe('POST /auth/google/token', () => {
  it('returns 400 when idToken is missing', async () => {
    const app = buildApp();
    const res = await app.request(
      '/auth/google/token',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) },
      env,
      createExecutionContext(),
    );
    expect(res.status).toBe(400);
  });

  it('verifies the Google ID token and returns a bearer session token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            sub: 'google-sub-mobile',
            email: 'mobile-user@example.com',
            email_verified: true,
            aud: env.GOOGLE_CLIENT_ID,
            name: 'Mobile User',
          }),
        ),
      ),
    );

    const app = buildApp();
    const res = await app.request(
      '/auth/google/token',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: 'id-mobile-1' }) },
      env,
      createExecutionContext(),
    );

    expect(res.status).toBe(201);
    const body = await res.json<{ token: string; isNewUser: boolean }>();
    expect(body.token).toBeTruthy();
    expect(body.isNewUser).toBe(true);

    const session = await env.DB
      .prepare('SELECT user_id FROM sessions WHERE id = ?')
      .bind(body.token)
      .first<{ user_id: string }>();
    expect(session).not.toBeNull();
  });
});

describe('POST /auth/logout', () => {
  async function seedUser(id: string) {
    const now = new Date().toISOString();
    await env.DB
      .prepare(`INSERT INTO users (id, google_sub, email, created_at, last_login_at) VALUES (?, ?, ?, ?, ?)`)
      .bind(id, `sub-${id}`, `${id}@example.com`, now, now)
      .run();
  }

  it('deletes the session behind a cookie', async () => {
    await seedUser('u-logout');
    const session = await createSession(env.DB, 'u-logout');
    const app = buildApp();

    const res = await app.request(
      '/auth/logout',
      { method: 'POST', headers: { Cookie: `eve_session=${session.id}` } },
      env,
      createExecutionContext(),
    );
    expect(res.status).toBe(200);

    const remaining = await env.DB.prepare('SELECT id FROM sessions WHERE id = ?').bind(session.id).first();
    expect(remaining).toBeNull();
  });

  it('deletes the session behind a bearer token', async () => {
    await seedUser('u-logout-2');
    const session = await createSession(env.DB, 'u-logout-2');
    const app = buildApp();

    const res = await app.request(
      '/auth/logout',
      { method: 'POST', headers: { Authorization: `Bearer ${session.id}` } },
      env,
      createExecutionContext(),
    );
    expect(res.status).toBe(200);

    const remaining = await env.DB.prepare('SELECT id FROM sessions WHERE id = ?').bind(session.id).first();
    expect(remaining).toBeNull();
  });

  it('is idempotent when there is no session to delete', async () => {
    const app = buildApp();
    const res = await app.request('/auth/logout', { method: 'POST' }, env, createExecutionContext());
    expect(res.status).toBe(200);
  });
});
