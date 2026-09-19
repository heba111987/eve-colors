export interface QuestionRow {
  id: string;
  text: string;
  quadrant: string;
}

export async function pickQuestion(db: D1Database, userId: string): Promise<QuestionRow> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const recentlyUsed = await db
    .prepare('SELECT DISTINCT question_id FROM entries WHERE user_id = ? AND created_at >= ?')
    .bind(userId, sevenDaysAgo)
    .all<{ question_id: string }>();
  const excludedIds = recentlyUsed.results.map((row) => row.question_id);

  const eligible = excludedIds.length
    ? await db
        .prepare(
          `SELECT id, text, quadrant FROM questions WHERE active = 1 AND id NOT IN (${excludedIds.map(() => '?').join(',')})`,
        )
        .bind(...excludedIds)
        .all<QuestionRow>()
    : await db.prepare('SELECT id, text, quadrant FROM questions WHERE active = 1').all<QuestionRow>();

  if (eligible.results.length > 0) {
    return eligible.results[Math.floor(Math.random() * eligible.results.length)];
  }

  const fallback = await db
    .prepare(
      `SELECT q.id, q.text, q.quadrant
       FROM questions q
       LEFT JOIN entries e ON e.question_id = q.id AND e.user_id = ?
       WHERE q.active = 1
       GROUP BY q.id
       ORDER BY MAX(e.created_at) ASC
       LIMIT 1`,
    )
    .bind(userId)
    .first<QuestionRow>();

  if (!fallback) throw new Error('No active questions available.');
  return fallback;
}
