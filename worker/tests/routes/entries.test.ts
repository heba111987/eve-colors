import { beforeEach, describe, expect, it } from 'vitest';
import { env, createExecutionContext } from 'cloudflare:test';
import { Hono } from 'hono';
import { entryRoutes } from '../../src/routes/entries';
import { createSession, sessionCookie } from '../../src/lib/session';
import { todayUtc } from '../../src/lib/entries';
import type { AuthedBindings } from '../../src/middleware/require-auth';

function buildApp() {
  const app = new Hono<AuthedBindings>();
  app.route('/api/entries', entryRoutes);
  return app;
}

async function seedSignedInUser(id: string) {
  const now = new Date().toISOString();
  await env.DB
    .prepare(`INSERT INTO users (id, google_sub, email, created_at, last_login_at) VALUES (?, ?, ?, ?, ?)`)
    .bind(id, `sub-${id}`, `${id}@example.com`, now, now)
    .run();
  const session = await createSession(env.DB, id);
  return sessionCookie(session.id, 'localhost', session.expiresAt).split(';')[0];
}

async function seedQuestion(id: string) {
  await env.DB
    .prepare(`INSERT INTO questions (id, text, quadrant, created_at) VALUES (?, 'Q?', 'mental', ?)`)
    .bind(id, new Date().toISOString())
    .run();
}

describe('POST /api/entries', () => {
  beforeEach(async () => {
    // Clear seed questions so pickQuestion deterministically selects the one
    // question this test seeds (mirrors the pattern in lib/questions.test.ts).
    await env.DB.prepare('DELETE FROM questions WHERE id LIKE ?').bind('q-%').run();
  });

  it('creates today\'s entry with a picked question', async () => {
    await seedQuestion('q1');
    const cookie = await seedSignedInUser('u1');
    const app = buildApp();

    const res = await app.request(
      '/api/entries',
      { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ color: 'Teal' }) },
      env,
      createExecutionContext(),
    );
    expect(res.status).toBe(201);
    const body = await res.json<{ entry: { question: { id: string } } }>();
    expect(body.entry.question.id).toBe('q1');
  });

  it('rejects a second entry the same day with 409', async () => {
    await seedQuestion('q1');
    const cookie = await seedSignedInUser('u2');
    const app = buildApp();

    await app.request(
      '/api/entries',
      { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ color: 'Teal' }) },
      env,
      createExecutionContext(),
    );
    const second = await app.request(
      '/api/entries',
      { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ color: 'Gold' }) },
      env,
      createExecutionContext(),
    );
    expect(second.status).toBe(409);
  });

  it('rejects a request with no color with 400', async () => {
    const cookie = await seedSignedInUser('u3');
    const app = buildApp();
    const res = await app.request(
      '/api/entries',
      { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({}) },
      env,
      createExecutionContext(),
    );
    expect(res.status).toBe(400);
  });
});
