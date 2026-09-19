import { Hono } from 'hono';
import { requireAuth, type AuthedBindings } from '../middleware/require-auth';
import { pickQuestion } from '../lib/questions';
import { pickTask } from '../lib/tasks';
import { todayUtc } from '../lib/entries';

export const entryRoutes = new Hono<AuthedBindings>();

entryRoutes.post('/', requireAuth, async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{ color?: string }>();
  if (!body.color) return c.json({ error: 'color is required' }, 400);

  const existing = await c.env.DB
    .prepare('SELECT id FROM entries WHERE user_id = ? AND entry_date = ?')
    .bind(user.id, todayUtc())
    .first();
  if (existing) return c.json({ error: 'entry_already_exists_today' }, 409);

  const question = await pickQuestion(c.env.DB, user.id);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await c.env.DB
      .prepare(
        `INSERT INTO entries (id, user_id, color, question_id, entry_date, created_at, task_completed)
         VALUES (?, ?, ?, ?, ?, ?, 0)`,
      )
      .bind(id, user.id, body.color, question.id, todayUtc(), now)
      .run();
  } catch (err) {
    if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
      return c.json({ error: 'entry_already_exists_today' }, 409);
    }
    throw err;
  }

  return c.json({ entry: { id, color: body.color, entryDate: todayUtc(), question } }, 201);
});

interface EntryRow {
  id: string;
  user_id: string;
  color: string;
  question_id: string;
  answer_text: string | null;
  task_id: string | null;
  task_completed: number;
  entry_date: string;
}

async function loadOwnedEntry(db: D1Database, userId: string, entryId: string): Promise<EntryRow | null> {
  const row = await db
    .prepare('SELECT * FROM entries WHERE id = ? AND user_id = ?')
    .bind(entryId, userId)
    .first<EntryRow>();
  return row ?? null;
}

entryRoutes.patch('/:id', requireAuth, async (c) => {
  const user = c.get('user');
  const entryId = c.req.param('id');
  if (!entryId) return c.json({ error: 'not_found' }, 404);
  const entry = await loadOwnedEntry(c.env.DB, user.id, entryId);
  if (!entry) return c.json({ error: 'not_found' }, 404);

  const body = await c.req.json<{ answer?: string; taskCompleted?: boolean }>();

  if (typeof body.answer === 'string') {
    if (entry.answer_text !== null) return c.json({ error: 'already_answered' }, 409);
    const task = await pickTask(c.env.DB);
    await c.env.DB
      .prepare('UPDATE entries SET answer_text = ?, task_id = ? WHERE id = ?')
      .bind(body.answer, task.id, entryId)
      .run();
    return c.json({ entry: { ...entry, answerText: body.answer, task } });
  }

  if (body.taskCompleted === true) {
    if (!entry.task_id) return c.json({ error: 'no_task_assigned' }, 409);
    const completedAt = new Date().toISOString();
    await c.env.DB
      .prepare('UPDATE entries SET task_completed = 1, completed_at = ? WHERE id = ?')
      .bind(completedAt, entryId)
      .run();
    return c.json({ entry: { ...entry, taskCompleted: true, completedAt } });
  }

  return c.json({ error: 'no_recognized_update' }, 400);
});

entryRoutes.post('/:id/reroll-task', requireAuth, async (c) => {
  const user = c.get('user');
  const entryId = c.req.param('id');
  if (!entryId) return c.json({ error: 'not_found' }, 404);
  const entry = await loadOwnedEntry(c.env.DB, user.id, entryId);
  if (!entry) return c.json({ error: 'not_found' }, 404);
  if (entry.task_completed) return c.json({ error: 'task_already_completed' }, 409);
  if (!entry.task_id) return c.json({ error: 'no_task_assigned_yet' }, 409);

  const task = await pickTask(c.env.DB, entry.task_id);
  await c.env.DB.prepare('UPDATE entries SET task_id = ? WHERE id = ?').bind(task.id, entryId).run();
  return c.json({ task });
});

entryRoutes.get('/', requireAuth, async (c) => {
  const user = c.get('user');
  const cursor = c.req.query('cursor');
  const limit = 20;

  const rows = cursor
    ? await c.env.DB
        .prepare('SELECT * FROM entries WHERE user_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT ?')
        .bind(user.id, cursor, limit + 1)
        .all<EntryRow & { created_at: string }>()
    : await c.env.DB
        .prepare('SELECT * FROM entries WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
        .bind(user.id, limit + 1)
        .all<EntryRow & { created_at: string }>();

  const hasMore = rows.results.length > limit;
  const page = hasMore ? rows.results.slice(0, limit) : rows.results;
  return c.json({
    entries: page,
    nextCursor: hasMore ? page[page.length - 1].created_at : null,
  });
});

entryRoutes.delete('/:id', requireAuth, async (c) => {
  const user = c.get('user');
  const entryId = c.req.param('id');
  const result = await c.env.DB
    .prepare('DELETE FROM entries WHERE id = ? AND user_id = ?')
    .bind(entryId, user.id)
    .run();
  if (result.meta.changes === 0) return c.json({ error: 'not_found' }, 404);
  return c.json({ ok: true });
});
