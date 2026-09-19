import type { Context, Next } from 'hono';
import type { Env } from '../types';
import { getSessionUser, parseBearerToken, parseSessionId, type SessionUser } from '../lib/session';

export type AuthedBindings = { Bindings: Env; Variables: { user: SessionUser } };

export async function requireAuth(c: Context<AuthedBindings>, next: Next) {
  const sessionId =
    parseBearerToken(c.req.header('Authorization') ?? null) ?? parseSessionId(c.req.header('Cookie') ?? null);
  const user = sessionId ? await getSessionUser(c.env.DB, sessionId) : null;
  if (!user) return c.json({ error: 'unauthorized' }, 401);
  c.set('user', user);
  await next();
}
