import { afterEach, describe, expect, it, vi } from 'vitest';
import { env as workerEnv } from 'cloudflare:test';
import { exchangeCodeForTokens, googleAuthUrl, upsertGoogleUser, verifyIdToken } from '../../src/lib/auth-google';

const env = {
  GOOGLE_CLIENT_ID: 'client-123',
  GOOGLE_CLIENT_SECRET: 'secret-abc',
  GOOGLE_REDIRECT_URI: 'http://localhost:8787/auth/google/callback',
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('googleAuthUrl', () => {
  it('builds an authorization URL with the required params', () => {
    const url = new URL(googleAuthUrl(env, 'state-xyz'));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe('client-123');
    expect(url.searchParams.get('redirect_uri')).toBe(env.GOOGLE_REDIRECT_URI);
    expect(url.searchParams.get('state')).toBe('state-xyz');
    expect(url.searchParams.get('scope')).toBe('openid email profile');
  });
});

describe('exchangeCodeForTokens', () => {
  it('posts the code to the Google token endpoint and returns the JSON body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: 'a', id_token: 'b', expires_in: 3600, token_type: 'Bearer' }), {
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const tokens = await exchangeCodeForTokens(env, 'code-1');
    expect(tokens.id_token).toBe('b');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/token',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('throws when Google responds with an error status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('bad', { status: 400 })));
    await expect(exchangeCodeForTokens(env, 'bad-code')).rejects.toThrow();
  });
});

describe('verifyIdToken', () => {
  it('returns the decoded user info when the audience matches and email is verified', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ sub: 'sub-1', email: 'a@example.com', email_verified: true, aud: 'client-123' }),
          { status: 200 },
        ),
      ),
    );
    const info = await verifyIdToken('id-token-1', 'client-123');
    expect(info.sub).toBe('sub-1');
  });

  it('throws when the audience does not match', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ sub: 'sub-1', email: 'a@example.com', email_verified: true, aud: 'someone-else' }),
          { status: 200 },
        ),
      ),
    );
    await expect(verifyIdToken('id-token-1', 'client-123')).rejects.toThrow('audience mismatch');
  });

  it('throws when the email is not verified', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ sub: 'sub-1', email: 'a@example.com', email_verified: false, aud: 'client-123' }),
          { status: 200 },
        ),
      ),
    );
    await expect(verifyIdToken('id-token-1', 'client-123')).rejects.toThrow('not verified');
  });
});

describe('upsertGoogleUser', () => {
  it('creates a new user on first login', async () => {
    const result = await upsertGoogleUser(workerEnv.DB, {
      sub: 'sub-new', email: 'new@example.com', email_verified: true, aud: 'client-123', name: 'New',
    });
    expect(result.isNewUser).toBe(true);
    const row = await workerEnv.DB
      .prepare('SELECT email FROM users WHERE id = ?')
      .bind(result.userId)
      .first<{ email: string }>();
    expect(row?.email).toBe('new@example.com');
  });

  it('updates an existing user by google_sub on repeat login', async () => {
    const first = await upsertGoogleUser(workerEnv.DB, {
      sub: 'sub-repeat', email: 'old@example.com', email_verified: true, aud: 'client-123', name: 'Old Name',
    });
    const second = await upsertGoogleUser(workerEnv.DB, {
      sub: 'sub-repeat', email: 'new@example.com', email_verified: true, aud: 'client-123', name: 'New Name',
    });
    expect(second.isNewUser).toBe(false);
    expect(second.userId).toBe(first.userId);
    const row = await workerEnv.DB
      .prepare('SELECT email, display_name FROM users WHERE id = ?')
      .bind(first.userId)
      .first<{ email: string; display_name: string }>();
    expect(row?.email).toBe('new@example.com');
    expect(row?.display_name).toBe('New Name');
  });
});
