import { beforeEach, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { pickQuestion } from '../../src/lib/questions';

async function seedQuestion(id: string, textSuffix: string) {
  await env.DB
    .prepare(`INSERT INTO questions (id, text, quadrant, created_at) VALUES (?, ?, 'mental', ?)`)
    .bind(id, `Question ${textSuffix}`, new Date().toISOString())
    .run();
}

async function seedUser(id: string) {
  const now = new Date().toISOString();
  await env.DB
    .prepare(`INSERT INTO users (id, google_sub, email, created_at, last_login_at) VALUES (?, ?, ?, ?, ?)`)
    .bind(id, `sub-${id}`, `${id}@example.com`, now, now)
    .run();
}

async function seedEntry(id: string, userId: string, questionId: string, createdAt: string) {
  await env.DB
    .prepare(
      `INSERT INTO entries (id, user_id, color, question_id, entry_date, created_at) VALUES (?, ?, 'Teal', ?, ?, ?)`,
    )
    .bind(id, userId, questionId, createdAt.slice(0, 10), createdAt)
    .run();
}

describe('pickQuestion', () => {
  beforeEach(async () => {
    // Clear seed questions to ensure deterministic test behavior
    await env.DB.prepare('DELETE FROM questions WHERE id LIKE ?').bind('q-%').run();
    await seedUser('u1');
  });

  it('excludes a question the user answered within the last 7 days', async () => {
    await seedQuestion('qa', 'A');
    await seedQuestion('qb', 'B');
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    await seedEntry('e1', 'u1', 'qa', twoDaysAgo);

    for (let i = 0; i < 10; i += 1) {
      const question = await pickQuestion(env.DB, 'u1');
      expect(question.id).toBe('qb');
    }
  });

  it('makes a question eligible again after 7 days', async () => {
    await seedQuestion('qa', 'A');
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    await seedEntry('e1', 'u1', 'qa', eightDaysAgo);

    const question = await pickQuestion(env.DB, 'u1');
    expect(question.id).toBe('qa');
  });

  it('falls back to the least-recently-used question when every question was used in the last 7 days', async () => {
    await seedQuestion('qa', 'A');
    await seedQuestion('qb', 'B');
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    await seedEntry('e1', 'u1', 'qa', threeDaysAgo);
    await seedEntry('e2', 'u1', 'qb', oneDayAgo);

    const question = await pickQuestion(env.DB, 'u1');
    expect(question.id).toBe('qa');
  });
});
