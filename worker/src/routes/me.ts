import { Hono } from 'hono';
import { requireAuth, type AuthedBindings } from '../middleware/require-auth';
import { deletePostHogPerson } from '../lib/posthog';
import { clearSessionCookie } from '../lib/session';

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

meRoutes.delete('/', requireAuth, async (c) => {
  const user = c.get('user');

  let analyticsPurged = true;
  try {
    await deletePostHogPerson(c.env, user.email);
  } catch (err) {
    analyticsPurged = false;
    console.error('PostHog purge failed during account deletion:', err);
  }

  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM entries WHERE user_id = ?').bind(user.id),
    c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
    c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id),
  ]);

  c.header('Set-Cookie', clearSessionCookie(c.env.SESSION_COOKIE_DOMAIN));
  return c.json({ ok: true, analyticsPurged });
});
