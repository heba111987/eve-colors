import { Hono } from 'hono';
import type { Env } from '../types';
import { exchangeCodeForTokens, googleAuthUrl, upsertGoogleUser, verifyIdToken } from '../lib/auth-google';
import { clearSessionCookie, createSession, deleteSession, parseBearerToken, parseSessionId, sessionCookie } from '../lib/session';

const OAUTH_STATE_COOKIE = 'eve_oauth_state';

function readCookie(cookieHeader: string, name: string): string | undefined {
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export const authRoutes = new Hono<{ Bindings: Env }>();

// Web login: browser redirect + HttpOnly cookie.
authRoutes.get('/google/start', (c) => {
  const state = crypto.randomUUID();
  const url = googleAuthUrl(c.env, state);
  c.header(
    'Set-Cookie',
    `${OAUTH_STATE_COOKIE}=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=300`,
  );
  return c.redirect(url, 302);
});

authRoutes.get('/google/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const cookieState = readCookie(c.req.header('Cookie') ?? '', OAUTH_STATE_COOKIE);

  if (!code || !state || !cookieState || state !== cookieState) {
    return c.json({ error: 'invalid_oauth_state' }, 400);
  }

  const tokens = await exchangeCodeForTokens(c.env, code);
  const userInfo = await verifyIdToken(tokens.id_token, c.env.GOOGLE_CLIENT_ID);
  const { userId, isNewUser } = await upsertGoogleUser(c.env.DB, userInfo);

  const session = await createSession(c.env.DB, userId);
  c.header('Set-Cookie', sessionCookie(session.id, c.env.SESSION_COOKIE_DOMAIN, session.expiresAt));
  const destination = isNewUser ? '/consent' : '/today';
  return c.redirect(`${c.env.FRONTEND_BASE_URL}${destination}`, 302);
});

// Mobile login: the native app gets an ID token from Google's own Sign-In SDK
// (no redirect/cookie dance needed) and POSTs it here for a bearer session token.
authRoutes.post('/google/token', async (c) => {
  const body = await c.req.json<{ idToken?: string }>().catch(() => ({}) as { idToken?: string });
  if (!body.idToken) return c.json({ error: 'idToken is required' }, 400);

  const userInfo = await verifyIdToken(body.idToken, c.env.GOOGLE_CLIENT_ID);
  const { userId, isNewUser } = await upsertGoogleUser(c.env.DB, userInfo);
  const session = await createSession(c.env.DB, userId);

  return c.json({ token: session.id, expiresAt: session.expiresAt, isNewUser }, isNewUser ? 201 : 200);
});

// Works for both cookie and bearer sessions; always succeeds, even with no session.
authRoutes.post('/logout', async (c) => {
  const sessionId =
    parseBearerToken(c.req.header('Authorization') ?? null) ?? parseSessionId(c.req.header('Cookie') ?? null);
  if (sessionId) await deleteSession(c.env.DB, sessionId);
  c.header('Set-Cookie', clearSessionCookie(c.env.SESSION_COOKIE_DOMAIN));
  return c.json({ ok: true });
});
