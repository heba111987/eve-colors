import { describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';

const VALID_QUADRANTS = ['mental', 'physical', 'emotional', 'spiritual'];

describe('seed content', () => {
  it('has 11 active questions, all with a valid quadrant', async () => {
    const result = await env.DB
      .prepare('SELECT quadrant FROM questions WHERE active = 1')
      .all<{ quadrant: string }>();
    expect(result.results).toHaveLength(11);
    for (const row of result.results) {
      expect(VALID_QUADRANTS).toContain(row.quadrant);
    }
  });

  it('has 33 active tasks, all with a valid quadrant', async () => {
    const result = await env.DB
      .prepare('SELECT quadrant FROM tasks WHERE active = 1')
      .all<{ quadrant: string }>();
    expect(result.results).toHaveLength(33);
    for (const row of result.results) {
      expect(VALID_QUADRANTS).toContain(row.quadrant);
    }
  });
});
