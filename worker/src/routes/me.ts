import { Hono } from 'hono';
import { requireAuth, type AuthedBindings } from '../middleware/require-auth';

export const meRoutes = new Hono<AuthedBindings>();

meRoutes.get('/', requireAuth, (c) => {
  return c.json({ user: c.get('user') });
});

meRoutes.post('/consent', requireAuth, async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{ analyticsMarketing?: boolean }>();
  const now = new Date().toISOString();
  await c.env.DB
    .prepare(
      `UPDATE users
       SET consent_accepted_at = COALESCE(consent_accepted_at, ?),
           analytics_marketing_consent_at = ?
       WHERE id = ?`,
    )
    .bind(now, body.analyticsMarketing ? now : null, user.id)
    .run();
  return c.json({ ok: true });
});
