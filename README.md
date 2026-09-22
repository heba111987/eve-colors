# Eve Colors

Eve Colors is a wellness journaling app for a quick daily check-in: pick a
color that matches how you feel, answer a short reflection question, then
get a small suggested activity to do. Completing a day's activity plants a
flower in your private garden, at its own spot.

**Eve Colors is a wellness tool, not a medical device.** It does not
provide medical advice, diagnosis, or treatment.

## How it works

1. **Pick a color** — a mood label for the day (11 presets, admin-editable).
2. **Answer a question** — drawn at random from a growing bank, never
   repeating within 7 days.
3. **Do a small activity** — suggested at random after answering; you can
   ask for a different one before committing.
4. **Watch your garden grow** — completing an activity plants a flower at
   a server-assigned spot in your garden.

Every question and activity is tagged to one of four wellness quadrants —
**mental, physical, emotional, spiritual** — purely descriptive, not a
score or diagnosis.

## Privacy & GDPR

- We collect your Google account email and name to run your account.
- Analytics (PostHog, EU region) and marketing email are **opt-in**, off
  by default, separate from the required terms you accept to use the app.
  We never sell your email address.
- Deleting your account permanently removes your entries and account
  record, and purges your analytics data too.

## Framework overview

- **Backend** — [Laravel 13](https://laravel.com), REST API + [Filament](https://filamentphp.com)
  admin panel (`/admin`), one codebase.
- **Auth** — [Socialite](https://laravel.com/docs/socialite) (Google SSO,
  web) + [Sanctum](https://laravel.com/docs/sanctum) (API auth — cookie
  for web, bearer token for the future mobile app; both behind one
  `auth:sanctum` guard).
- **Database** — MySQL in production (Laravel Cloud managed), SQLite
  in-memory for tests.
- **Hosting** — [Laravel Cloud](https://cloud.laravel.com), connected
  directly to this repo.
- **Analytics** — PostHog Cloud, EU region, loaded only for users who
  opt in (client-side integration is part of the future client app).

Planned repo layout once the client app lands:

```
/                — Laravel app (this repo's root)
/client          — Expo app (web + iOS + Android from one codebase) — not built yet
```

## Local development

1. `composer install`
2. `cp .env.example .env && php artisan key:generate`
3. Fill in `.env`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `POSTHOG_PROJECT_ID`,
   `POSTHOG_DELETION_API_KEY` — a real Google Cloud OAuth client and PostHog EU project
   are the repo owner's setup steps, not something run from this codebase.
4. `php artisan migrate --seed`
5. `php artisan serve`

Run the test suite with `php artisan test` (uses an in-memory SQLite database,
no setup needed).

## Status

Server-side phase complete: Laravel API (Google SSO for web + mobile, the
full daily color→question→activity→garden flow, GDPR account deletion,
consent enforcement) and the Filament admin panel (Users, Colors,
Questions, Activities, and a view-only Daily Entries resource). No client
app exists yet — that's the next phase, built with Expo so the same
codebase targets web, iOS, and Android.

## Deployment (owner responsibility, not run from this codebase)

1. Create a Google Cloud OAuth client (External consent screen), authorized
   redirect URI = production `/auth/google/callback` URL.
2. Create/confirm the PostHog Cloud project (EU region) and its API keys.
3. Connect this repo to [Laravel Cloud](https://cloud.laravel.com);
   provision a MySQL resource.
4. Set environment secrets on Laravel Cloud: `GOOGLE_CLIENT_ID`,
   `GOOGLE_CLIENT_SECRET`, `POSTHOG_PROJECT_ID`, `POSTHOG_DELETION_API_KEY`,
   `FRONTEND_URL` (once a client domain exists), `SANCTUM_STATEFUL_DOMAINS`
   (once a client domain exists).
5. Point DNS at Laravel Cloud once ready.
6. Deploys run migrations + seeders automatically via Laravel Cloud's deploy
   hooks (confirm this is configured in the Laravel Cloud dashboard — it's
   not a file in this repo).
