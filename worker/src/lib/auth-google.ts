import type { Env } from '../types';

export interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  expires_in: number;
  token_type: string;
}

export interface GoogleUserInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  aud: string;
}

type GoogleAuthEnv = Pick<Env, 'GOOGLE_CLIENT_ID' | 'GOOGLE_CLIENT_SECRET' | 'GOOGLE_REDIRECT_URI'>;

export function googleAuthUrl(env: GoogleAuthEnv, state: string): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  url.searchParams.set('redirect_uri', env.GOOGLE_REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  url.searchParams.set('access_type', 'online');
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

export async function exchangeCodeForTokens(
  env: GoogleAuthEnv,
  code: string,
): Promise<GoogleTokenResponse> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  if (!response.ok) throw new Error(`Google token exchange failed: ${response.status}`);
  return response.json();
}

export async function verifyIdToken(idToken: string, expectedAudience: string): Promise<GoogleUserInfo> {
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
  );
  if (!response.ok) throw new Error(`Google tokeninfo failed: ${response.status}`);
  const info = await response.json<GoogleUserInfo>();
  if (info.aud !== expectedAudience) throw new Error('ID token audience mismatch');
  if (!info.email_verified) throw new Error('Google email not verified');
  return info;
}

export async function upsertGoogleUser(
  db: D1Database,
  userInfo: GoogleUserInfo,
): Promise<{ userId: string; isNewUser: boolean }> {
  const now = new Date().toISOString();
  const existing = await db
    .prepare('SELECT id FROM users WHERE google_sub = ?')
    .bind(userInfo.sub)
    .first<{ id: string }>();

  if (existing) {
    await db
      .prepare('UPDATE users SET last_login_at = ?, email = ?, display_name = ? WHERE id = ?')
      .bind(now, userInfo.email, userInfo.name ?? null, existing.id)
      .run();
    return { userId: existing.id, isNewUser: false };
  }

  const userId = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO users (id, google_sub, email, display_name, created_at, last_login_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(userId, userInfo.sub, userInfo.email, userInfo.name ?? null, now, now)
    .run();
  return { userId, isNewUser: true };
}
