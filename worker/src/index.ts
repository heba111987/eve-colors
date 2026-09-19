import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';
import type { AuthedBindings } from './middleware/require-auth';
import { requireAuth } from './middleware/require-auth';
import { authRoutes } from './routes/auth';
import { meRoutes } from './routes/me';
import { entryRoutes } from './routes/entries';
import { loadTodayEntry } from './lib/entries';

const app = new Hono<AuthedBindings>();

app.use('*', async (c, next) => {
  const middleware = cors({ origin: c.env.FRONTEND_BASE_URL, credentials: true });
  return middleware(c, next);
});

app.route('/auth', authRoutes);
app.route('/api/me', meRoutes);
app.route('/api/entries', entryRoutes);

app.get('/api/today', requireAuth, async (c) => {
  const user = c.get('user');
  const entry = await loadTodayEntry(c.env.DB, user.id);
  return c.json({ entry });
});

export default app;
export type { Env };
