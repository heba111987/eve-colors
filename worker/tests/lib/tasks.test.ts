import { beforeEach, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { pickTask } from '../../src/lib/tasks';

async function seedTask(id: string, textSuffix: string) {
  await env.DB
    .prepare(`INSERT INTO tasks (id, text, quadrant, created_at) VALUES (?, ?, 'physical', ?)`)
    .bind(id, `Task ${textSuffix}`, new Date().toISOString())
    .run();
}

describe('pickTask', () => {
  beforeEach(async () => {
    // Clear seed tasks to ensure deterministic test behavior
    await env.DB.prepare('DELETE FROM tasks WHERE id LIKE ?').bind('t-%').run();
  });
  it('returns a task from the active pool', async () => {
    await seedTask('ta', 'A');
    const task = await pickTask(env.DB);
    expect(task.id).toBe('ta');
  });

  it('excludes the given task id when rerolling, if another task exists', async () => {
    await seedTask('ta', 'A');
    await seedTask('tb', 'B');
    for (let i = 0; i < 10; i += 1) {
      const task = await pickTask(env.DB, 'ta');
      expect(task.id).toBe('tb');
    }
  });

  it('falls back to the excluded task if it is the only one available', async () => {
    await seedTask('ta', 'A');
    const task = await pickTask(env.DB, 'ta');
    expect(task.id).toBe('ta');
  });

  it('throws when there are no active tasks at all', async () => {
    await expect(pickTask(env.DB)).rejects.toThrow('No active tasks available.');
  });
});
