import { describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';

describe('D1 schema', () => {
  it('creates all five tables', async () => {
    const result = await env.DB
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all<{ name: string }>();
    const names = result.results.map((row) => row.name);
    expect(names).toEqual(
      expect.arrayContaining(['users', 'sessions', 'questions', 'tasks', 'entries']),
    );
  });

  it('enforces one entry per user per day', async () => {
    const now = new Date().toISOString();
    await env.DB
      .prepare(
        `INSERT INTO users (id, google_sub, email, created_at, last_login_at) VALUES ('u1', 'sub1', 'a@example.com', ?, ?)`,
      )
      .bind(now, now)
      .run();
    await env.DB
      .prepare(
        `INSERT INTO questions (id, text, quadrant, created_at) VALUES ('q1', 'Q?', 'mental', ?)`,
      )
      .bind(now)
      .run();
    await env.DB
      .prepare(
        `INSERT INTO entries (id, user_id, color, question_id, entry_date, created_at) VALUES ('e1', 'u1', 'Teal', 'q1', '2026-09-18', ?)`,
      )
      .bind(now)
      .run();

    await expect(
      env.DB
        .prepare(
          `INSERT INTO entries (id, user_id, color, question_id, entry_date, created_at) VALUES ('e2', 'u1', 'Gold', 'q1', '2026-09-18', ?)`,
        )
        .bind(now)
        .run(),
    ).rejects.toThrow();
  });
});
