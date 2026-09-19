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

// Seeds a user who has accepted the required wellness/terms consent — the
// state any real user of these routes is in, since requireConsent now blocks
// the entry routes for anyone who hasn't. See the consent tests at the bottom
// of this file for the not-yet-consented case.
async function seedSignedInUser(id: string, consentAcceptedAt: string | null = new Date().toISOString()) {
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

async function createTodayEntry(app: Hono<AuthedBindings>, cookie: string): Promise<string> {
  const res = await app.request(
    '/api/entries',
    { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ color: 'Teal' }) },
    env,
    createExecutionContext(),
  );
  const body = await res.json<{ entry: { id: string } }>();
  return body.entry.id;
}

describe('PATCH /api/entries/:id (answer)', () => {
  beforeEach(async () => {
    // Clear seed tasks so pickTask deterministically selects the one task this
    // test seeds (mirrors the pattern already established for questions in
    // Tasks 8 and 10 — pickTask otherwise picks randomly among the 33 seeded
    // production tasks too, making the task.id assertion below flaky).
    await env.DB.prepare('DELETE FROM tasks WHERE id LIKE ?').bind('t-%').run();
  });

  it('saves the answer and assigns a task', async () => {
    await seedQuestion('q1');
    await env.DB
      .prepare(`INSERT INTO tasks (id, text, quadrant, created_at) VALUES ('t1', 'Take a walk.', 'physical', ?)`)
      .bind(new Date().toISOString())
      .run();
    const cookie = await seedSignedInUser('u4');
    const app = buildApp();
    const entryId = await createTodayEntry(app, cookie);

    const res = await app.request(
      `/api/entries/${entryId}`,
      { method: 'PATCH', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ answer: 'I feel steady today.' }) },
      env,
      createExecutionContext(),
    );
    expect(res.status).toBe(200);
    const body = await res.json<{ entry: { task: { id: string } } }>();
    expect(body.entry.task.id).toBe('t1');
  });

  it('rejects answering the same entry twice with 409', async () => {
    await seedQuestion('q1');
    await env.DB
      .prepare(`INSERT INTO tasks (id, text, quadrant, created_at) VALUES ('t1', 'Take a walk.', 'physical', ?)`)
      .bind(new Date().toISOString())
      .run();
    const cookie = await seedSignedInUser('u5');
    const app = buildApp();
    const entryId = await createTodayEntry(app, cookie);

    await app.request(
      `/api/entries/${entryId}`,
      { method: 'PATCH', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ answer: 'first' }) },
      env,
      createExecutionContext(),
    );
    const second = await app.request(
      `/api/entries/${entryId}`,
      { method: 'PATCH', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ answer: 'second' }) },
      env,
      createExecutionContext(),
    );
    expect(second.status).toBe(409);
  });
});

describe('PATCH /api/entries/:id (taskCompleted)', () => {
  it('marks the task complete', async () => {
    await seedQuestion('q1');
    await env.DB
      .prepare(`INSERT INTO tasks (id, text, quadrant, created_at) VALUES ('t1', 'Take a walk.', 'physical', ?)`)
      .bind(new Date().toISOString())
      .run();
    const cookie = await seedSignedInUser('u6');
    const app = buildApp();
    const entryId = await createTodayEntry(app, cookie);
    await app.request(
      `/api/entries/${entryId}`,
      { method: 'PATCH', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ answer: 'answer' }) },
      env,
      createExecutionContext(),
    );

    const res = await app.request(
      `/api/entries/${entryId}`,
      { method: 'PATCH', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ taskCompleted: true }) },
      env,
      createExecutionContext(),
    );
    expect(res.status).toBe(200);
    const row = await env.DB.prepare('SELECT task_completed FROM entries WHERE id = ?').bind(entryId).first<{ task_completed: number }>();
    expect(row?.task_completed).toBe(1);
  });
});

describe('POST /api/entries/:id/reroll-task', () => {
  it('assigns a different task before completion', async () => {
    await seedQuestion('q1');
    await env.DB
      .prepare(
        `INSERT INTO tasks (id, text, quadrant, created_at) VALUES ('t1', 'Take a walk.', 'physical', ?), ('t2', 'Meditate.', 'spiritual', ?)`,
      )
      .bind(new Date().toISOString(), new Date().toISOString())
      .run();
    const cookie = await seedSignedInUser('u7');
    const app = buildApp();
    const entryId = await createTodayEntry(app, cookie);
    const answerRes = await app.request(
      `/api/entries/${entryId}`,
      { method: 'PATCH', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ answer: 'answer' }) },
      env,
      createExecutionContext(),
    );
    const answerBody = await answerRes.json<{ entry: { task: { id: string } } }>();
    const firstTaskId = answerBody.entry.task.id;

    const res = await app.request(
      `/api/entries/${entryId}/reroll-task`,
      { method: 'POST', headers: { Cookie: cookie } },
      env,
      createExecutionContext(),
    );
    expect(res.status).toBe(200);
    const body = await res.json<{ task: { id: string } }>();
    expect(body.task.id).not.toBe(firstTaskId);
  });

  it('rejects rerolling after the task is completed', async () => {
    await seedQuestion('q1');
    await env.DB
      .prepare(`INSERT INTO tasks (id, text, quadrant, created_at) VALUES ('t1', 'Take a walk.', 'physical', ?)`)
      .bind(new Date().toISOString())
      .run();
    const cookie = await seedSignedInUser('u8');
    const app = buildApp();
    const entryId = await createTodayEntry(app, cookie);
    await app.request(
      `/api/entries/${entryId}`,
      { method: 'PATCH', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ answer: 'answer' }) },
      env,
      createExecutionContext(),
    );
    await app.request(
      `/api/entries/${entryId}`,
      { method: 'PATCH', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ taskCompleted: true }) },
      env,
      createExecutionContext(),
    );

    const res = await app.request(
      `/api/entries/${entryId}/reroll-task`,
      { method: 'POST', headers: { Cookie: cookie } },
      env,
      createExecutionContext(),
    );
    expect(res.status).toBe(409);
  });
});

async function seedManualEntry(userId: string, id: string, daysAgo: number) {
  const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  await env.DB
    .prepare(
      `INSERT INTO entries (id, user_id, color, question_id, entry_date, created_at) VALUES (?, ?, 'Teal', 'q1', ?, ?)`,
    )
    .bind(id, userId, createdAt.slice(0, 10), createdAt)
    .run();
}

describe('GET /api/entries', () => {
  it('returns entries newest first with pagination', async () => {
    await seedQuestion('q1');
    const cookie = await seedSignedInUser('u9');
    await seedManualEntry('u9', 'e1', 10);
    await seedManualEntry('u9', 'e2', 5);
    await seedManualEntry('u9', 'e3', 1);
    const app = buildApp();

    const res = await app.request('/api/entries', { headers: { Cookie: cookie } }, env, createExecutionContext());
    expect(res.status).toBe(200);
    const body = await res.json<{ entries: Array<{ id: string }>; nextCursor: string | null }>();
    expect(body.entries.map((e) => e.id)).toEqual(['e3', 'e2', 'e1']);
    expect(body.nextCursor).toBeNull();
  });

  it('paginates across two pages using the returned cursor', async () => {
    await seedQuestion('q1');
    const cookie = await seedSignedInUser('u15');
    const ids = Array.from({ length: 22 }, (_, i) => `p${String(i + 1).padStart(2, '0')}`);
    // daysAgo = 1..22, so p01 is newest and p22 is oldest.
    for (let i = 0; i < ids.length; i++) {
      await seedManualEntry('u15', ids[i], i + 1);
    }
    const app = buildApp();

    const page1Res = await app.request('/api/entries', { headers: { Cookie: cookie } }, env, createExecutionContext());
    expect(page1Res.status).toBe(200);
    const page1 = await page1Res.json<{ entries: Array<{ id: string; created_at: string }>; nextCursor: string | null }>();
    expect(page1.entries.map((e) => e.id)).toEqual(ids.slice(0, 20));
    expect(page1.nextCursor).not.toBeNull();
    expect(page1.nextCursor).toBe(page1.entries[19].created_at);

    const page2Res = await app.request(
      '/api/entries?cursor=' + encodeURIComponent(page1.nextCursor as string),
      { headers: { Cookie: cookie } },
      env,
      createExecutionContext(),
    );
    expect(page2Res.status).toBe(200);
    const page2 = await page2Res.json<{ entries: Array<{ id: string }>; nextCursor: string | null }>();
    expect(page2.entries.map((e) => e.id)).toEqual(ids.slice(20));
    expect(page2.nextCursor).toBeNull();
  });

  it('only returns the requesting user\'s entries', async () => {
    await seedQuestion('q1');
    const cookieA = await seedSignedInUser('u10');
    await seedSignedInUser('u11');
    await seedManualEntry('u10', 'e-a', 1);
    await seedManualEntry('u11', 'e-b', 1);
    const app = buildApp();

    const res = await app.request('/api/entries', { headers: { Cookie: cookieA } }, env, createExecutionContext());
    const body = await res.json<{ entries: Array<{ id: string }> }>();
    expect(body.entries.map((e) => e.id)).toEqual(['e-a']);
  });
});

describe('DELETE /api/entries/:id', () => {
  it('deletes an entry the user owns', async () => {
    await seedQuestion('q1');
    const cookie = await seedSignedInUser('u12');
    await seedManualEntry('u12', 'e-owned', 1);
    const app = buildApp();

    const res = await app.request(
      '/api/entries/e-owned',
      { method: 'DELETE', headers: { Cookie: cookie } },
      env,
      createExecutionContext(),
    );
    expect(res.status).toBe(200);
    const row = await env.DB.prepare('SELECT id FROM entries WHERE id = ?').bind('e-owned').first();
    expect(row).toBeNull();
  });

  it('returns 404 for an entry owned by someone else', async () => {
    await seedQuestion('q1');
    await seedSignedInUser('u13');
    const cookieB = await seedSignedInUser('u14');
    await seedManualEntry('u13', 'e-not-mine', 1);
    const app = buildApp();

    const res = await app.request(
      '/api/entries/e-not-mine',
      { method: 'DELETE', headers: { Cookie: cookieB } },
      env,
      createExecutionContext(),
    );
    expect(res.status).toBe(404);
    const row = await env.DB.prepare('SELECT id FROM entries WHERE id = ?').bind('e-not-mine').first();
    expect(row).not.toBeNull();
  });
});

describe('consent enforcement on /api/entries', () => {
  it('returns 403 consent_required from POST /api/entries for a signed-in user who has not consented', async () => {
    const cookie = await seedSignedInUser('u-noconsent-1', null);
    const app = buildApp();

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

    // The request must not have created anything.
    const row = await env.DB.prepare('SELECT id FROM entries WHERE user_id = ?').bind('u-noconsent-1').first();
    expect(row).toBeNull();
  });

  it('returns 403 consent_required from GET /api/entries for a signed-in user who has not consented', async () => {
    const cookie = await seedSignedInUser('u-noconsent-2', null);
    const app = buildApp();

    const res = await app.request('/api/entries', { headers: { Cookie: cookie } }, env, createExecutionContext());

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'consent_required' });
  });

  it('returns 403 consent_required from DELETE /api/entries/:id for a signed-in user who has not consented', async () => {
    // seedManualEntry hardcodes question_id 'q1'.
    await seedQuestion('q1');
    const cookie = await seedSignedInUser('u-noconsent-3', null);
    await seedManualEntry('u-noconsent-3', 'e-noconsent', 1);
    const app = buildApp();

    const res = await app.request(
      '/api/entries/e-noconsent',
      { method: 'DELETE', headers: { Cookie: cookie } },
      env,
      createExecutionContext(),
    );

    expect(res.status).toBe(403);
    const row = await env.DB.prepare('SELECT id FROM entries WHERE id = ?').bind('e-noconsent').first();
    expect(row).not.toBeNull();
  });

  it('still returns 401, not 403, when there is no session at all', async () => {
    const app = buildApp();
    const res = await app.request('/api/entries', {}, env, createExecutionContext());
    expect(res.status).toBe(401);
  });
});
