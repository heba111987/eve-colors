import { describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { loadTodayEntry, todayUtc } from '../../src/lib/entries';

describe('todayUtc', () => {
  it('returns a YYYY-MM-DD string', () => {
    expect(todayUtc()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('loadTodayEntry', () => {
  it('returns null when the user has no entry today', async () => {
    const entry = await loadTodayEntry(env.DB, 'no-such-user');
    expect(entry).toBeNull();
  });

  it('returns the joined entry, question, and task when one exists', async () => {
    const now = new Date().toISOString();
    await env.DB
      .prepare(`INSERT INTO users (id, google_sub, email, created_at, last_login_at) VALUES ('u1','s1','u1@example.com', ?, ?)`)
      .bind(now, now)
      .run();
    await env.DB
      .prepare(`INSERT INTO questions (id, text, quadrant, created_at) VALUES ('q1', 'Q?', 'mental', ?)`)
      .bind(now)
      .run();
    await env.DB
      .prepare(
        `INSERT INTO entries (id, user_id, color, question_id, entry_date, created_at) VALUES ('e1', 'u1', 'Teal', 'q1', ?, ?)`,
      )
      .bind(todayUtc(), now)
      .run();

    const entry = await loadTodayEntry(env.DB, 'u1');
    expect(entry?.id).toBe('e1');
    expect(entry?.question_text).toBe('Q?');
    expect(entry?.task_id).toBeNull();
  });
});
