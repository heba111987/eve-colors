import { Hono } from 'hono';
import { requireAuth, type AuthedBindings } from '../middleware/require-auth';
import { pickQuestion } from '../lib/questions';
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
