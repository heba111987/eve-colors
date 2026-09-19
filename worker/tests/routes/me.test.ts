import { describe, expect, it, vi, afterEach } from 'vitest';
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

afterEach(() => {
  vi.restoreAllMocks();
});

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

describe('DELETE /api/me', () => {
  it('deletes the user, their sessions and entries, purges PostHog, and clears the cookie', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 })),
    );
    const cookie = await seedSignedInUser('u3');
    const now = new Date().toISOString();
    await env.DB
      .prepare(`INSERT INTO questions (id, text, quadrant, created_at) VALUES ('q-del', 'Q?', 'mental', ?)`)
      .bind(now)
      .run();
    await env.DB
      .prepare(
        `INSERT INTO entries (id, user_id, color, question_id, entry_date, created_at) VALUES ('e-del', 'u3', 'Teal', 'q-del', '2026-09-18', ?)`,
      )
      .bind(now)
      .run();

    const app = buildApp();
    const res = await app.request(
      '/api/me',
      { method: 'DELETE', headers: { Cookie: cookie } },
      env,
      createExecutionContext(),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Set-Cookie')).toContain('Max-Age=0');
    expect(await res.json()).toEqual({ ok: true, analyticsPurged: true });

    const user = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind('u3').first();
    const entry = await env.DB.prepare('SELECT id FROM entries WHERE id = ?').bind('e-del').first();
    expect(user).toBeNull();
    expect(entry).toBeNull();
  });

  it('still deletes all D1 rows when the PostHog purge fails, reporting analyticsPurged: false', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network unreachable')));
    const cookie = await seedSignedInUser('u4');
    const now = new Date().toISOString();
    await env.DB
      .prepare(`INSERT INTO questions (id, text, quadrant, created_at) VALUES ('q-del4', 'Q?', 'mental', ?)`)
      .bind(now)
      .run();
    await env.DB
      .prepare(
        `INSERT INTO entries (id, user_id, color, question_id, entry_date, created_at) VALUES ('e-del4', 'u4', 'Teal', 'q-del4', '2026-09-18', ?)`,
      )
      .bind(now)
      .run();

    const app = buildApp();
    const res = await app.request(
      '/api/me',
      { method: 'DELETE', headers: { Cookie: cookie } },
      env,
      createExecutionContext(),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, analyticsPurged: false });
    expect(res.headers.get('Set-Cookie')).toContain('Max-Age=0');

    const user = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind('u4').first();
    const entry = await env.DB.prepare('SELECT id FROM entries WHERE id = ?').bind('e-del4').first();
    const session = await env.DB.prepare('SELECT id FROM sessions WHERE user_id = ?').bind('u4').first();
    expect(user).toBeNull();
    expect(entry).toBeNull();
    expect(session).toBeNull();
  });

  it('still deletes all D1 rows when the PostHog lookup returns a non-OK status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 403 })));
    const cookie = await seedSignedInUser('u5');

    const app = buildApp();
    const res = await app.request(
      '/api/me',
      { method: 'DELETE', headers: { Cookie: cookie } },
      env,
      createExecutionContext(),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, analyticsPurged: false });

    const user = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind('u5').first();
    const session = await env.DB.prepare('SELECT id FROM sessions WHERE user_id = ?').bind('u5').first();
    expect(user).toBeNull();
    expect(session).toBeNull();
  });
});
