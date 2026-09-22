# Eve Colors — Web Client

The Expo web client for Eve Colors, consuming the Laravel API in this
repo's root. Web target only for this phase — the same Expo Router
codebase is designed to add iOS/Android later with no rewrite.

## Local development

1. `npm install`
2. Copy `.env.example` to `.env` if present, or set `EXPO_PUBLIC_API_URL`
   to point at your local Laravel server (defaults to
   `http://localhost:8000` if unset).
3. Make sure the Laravel API's `.env` has `SANCTUM_STATEFUL_DOMAINS`
   and `CORS_ALLOWED_ORIGINS` including `localhost:8081` (already set
   by this repo's own server setup).
4. `npm run web` — starts the dev server on port 8081, matching the
   Laravel API's configured `FRONTEND_URL`.

Signing in locally requires a real Google OAuth client configured on
the Laravel side (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` in its
`.env`) — without one, the sign-in button's redirect will reach Google
and fail there. See the root README's deployment section.

## Structure

- `app/` — Expo Router screens (file-based routing)
- `components/` — themed UI primitives
- `lib/` — API client, TanStack Query hooks, theme tokens
- `assets/` — bundled images (lotus icons per color)

## Status

Color → question → task → bloom daily flow, garden (real flower
coordinates), entry detail, settings, and account deletion are built.
Not built yet: iOS/Android builds, offline support, garden data
export.
