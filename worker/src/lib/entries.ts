export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface TodayEntryRow {
  id: string;
  color: string;
  answer_text: string | null;
  task_completed: number;
  entry_date: string;
  question_id: string;
  question_text: string;
  question_quadrant: string;
  task_id: string | null;
  task_text: string | null;
  task_quadrant: string | null;
}

export async function loadTodayEntry(db: D1Database, userId: string): Promise<TodayEntryRow | null> {
  const row = await db
    .prepare(
      `SELECT e.id, e.color, e.answer_text, e.task_completed, e.entry_date,
              q.id as question_id, q.text as question_text, q.quadrant as question_quadrant,
              t.id as task_id, t.text as task_text, t.quadrant as task_quadrant
       FROM entries e
       JOIN questions q ON q.id = e.question_id
       LEFT JOIN tasks t ON t.id = e.task_id
       WHERE e.user_id = ? AND e.entry_date = ?`,
    )
    .bind(userId, todayUtc())
    .first<TodayEntryRow>();
  return row ?? null;
}
