import { describe, expect, it } from 'vitest';
import { env, createExecutionContext } from 'cloudflare:test';
import { Hono } from 'hono';
import { meRoutes } from '../../src/routes/me';
import { createSession, sessionCookie } from '../../src/lib/session';
import type { Env } from '../../src/types';
import type { AuthedBindings } from '../../src/middleware/require-auth';

function buildApp() {
  const app = new Hono<AuthedBindings>();
  app.route('/api/me', meRoutes);
  return app;
}

async function seedSignedInUser(id: string) {
  const now = new Date().toISOString();
  await env.DB
    .prepare(
      `INSERT INTO users (id, google_sub, email, created_at, last_login_at) VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(id, `sub-${id}`, `${id}@example.com`, now, now)
    .run();
  const session = await createSession(env.DB, id);
  return sessionCookie(session.id, 'localhost', session.expiresAt).split(';')[0];
}

describe('GET /api/me', () => {
  it('returns 401 with no session cookie', async () => {
    const app = buildApp();
    const res = await app.request('/api/me', {}, env, createExecutionContext());
    expect(res.status).toBe(401);
  });

  it('returns the user with null consent fields for a fresh signup', async () => {
    const cookie = await seedSignedInUser('u1');
    const app = buildApp();
    const res = await app.request('/api/me', { headers: { Cookie: cookie } }, env, createExecutionContext());
    expect(res.status).toBe(200);
    const body = await res.json<{ user: { email: string; consentAcceptedAt: string | null } }>();
    expect(body.user.email).toBe('u1@example.com');
    expect(body.user.consentAcceptedAt).toBeNull();
  });

  it('authenticates via an Authorization: Bearer header instead of a cookie', async () => {
    const now = new Date().toISOString();
    await env.DB
      .prepare(`INSERT INTO users (id, google_sub, email, created_at, last_login_at) VALUES ('u1b','sub-u1b','u1b@example.com', ?, ?)`)
      .bind(now, now)
      .run();
    const session = await createSession(env.DB, 'u1b');
    const app = buildApp();
    const res = await app.request(
      '/api/me',
      { headers: { Authorization: `Bearer ${session.id}` } },
      env,
      createExecutionContext(),
    );
    expect(res.status).toBe(200);
    const body = await res.json<{ user: { email: string } }>();
    expect(body.user.email).toBe('u1b@example.com');
  });
});

describe('POST /api/me/consent', () => {
  it('stamps consentAcceptedAt once and lets analytics consent be toggled afterward', async () => {
    const cookie = await seedSignedInUser('u2');
    const app = buildApp();

    const first = await app.request(
      '/api/me/consent',
      { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ analyticsMarketing: true }) },
      env,
      createExecutionContext(),
    );
    expect(first.status).toBe(200);

    const afterFirst = await env.DB
      .prepare('SELECT consent_accepted_at, analytics_marketing_consent_at FROM users WHERE id = ?')
      .bind('u2')
      .first<{ consent_accepted_at: string; analytics_marketing_consent_at: string }>();
    expect(afterFirst?.consent_accepted_at).not.toBeNull();
    expect(afterFirst?.analytics_marketing_consent_at).not.toBeNull();

    await app.request(
      '/api/me/consent',
      { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ analyticsMarketing: false }) },
      env,
      createExecutionContext(),
    );
    const afterSecond = await env.DB
      .prepare('SELECT consent_accepted_at, analytics_marketing_consent_at FROM users WHERE id = ?')
      .bind('u2')
      .first<{ consent_accepted_at: string; analytics_marketing_consent_at: string | null }>();
    expect(afterSecond?.consent_accepted_at).toBe(afterFirst?.consent_accepted_at);
    expect(afterSecond?.analytics_marketing_consent_at).toBeNull();
  });
});
