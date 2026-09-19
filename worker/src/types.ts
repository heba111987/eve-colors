export interface Env {
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  SESSION_COOKIE_DOMAIN: string;
  FRONTEND_BASE_URL: string;
  POSTHOG_PROJECT_ID: string;
  POSTHOG_DELETION_API_KEY: string;
}
