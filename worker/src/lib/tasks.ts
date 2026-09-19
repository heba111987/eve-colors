export interface TaskRow {
  id: string;
  text: string;
  quadrant: string;
}

export async function pickTask(db: D1Database, excludeTaskId?: string): Promise<TaskRow> {
  const withExclusion = excludeTaskId
    ? await db
        .prepare('SELECT id, text, quadrant FROM tasks WHERE active = 1 AND id != ?')
        .bind(excludeTaskId)
        .all<TaskRow>()
    : null;

  const pool = withExclusion && withExclusion.results.length > 0
    ? withExclusion.results
    : (await db.prepare('SELECT id, text, quadrant FROM tasks WHERE active = 1').all<TaskRow>()).results;

  if (pool.length === 0) throw new Error('No active tasks available.');
  return pool[Math.floor(Math.random() * pool.length)];
}
