# Eve Colors

Eve Colors is a wellness web app for a quick daily check-in: pick a
color that matches how you feel, answer a short reflection question,
then get a small suggested task to do. Over time, a private timeline
("My Garden") shows the colors, questions, answers, and tasks from
every day you've shown up.

**Eve Colors is a wellness tool, not a medical device.** It does not
provide medical advice, diagnosis, or treatment. It's designed
primarily for women, as a lightweight, non-clinical way to check in
with yourself.

> This repo is mid-migration off Wix onto Cloudflare. See
> [`docs/superpowers/specs/2026-09-18-cloudflare-rebuild-design.md`](docs/superpowers/specs/2026-09-18-cloudflare-rebuild-design.md)
> for the full design spec this README summarizes.

## How it works

1. **Pick a color.** One of 11 preset colors, used as a mood label for
   the day — it doesn't change which question you get.
2. **Answer a question.** Drawn at random from a growing question
   bank, with a rule that you won't see the same question again within
   7 days.
3. **Do a small task.** After answering, the app suggests a random
   task (e.g. take a walk, meditate) — you can ask for a different one
   before committing.
4. **Look back anytime.** "My Garden" is a scrollable timeline of every
   day's color, question, answer, and task.

One entry per day. Every question and task is tagged to one of four
wellness quadrants — **mental, physical, emotional, spiritual** — so
the app can (eventually) reflect back how balanced your check-ins are
across those areas. This is descriptive only; it's not a score,
diagnosis, or recommendation engine.

## Privacy & GDPR

- We collect your Google account email and name to run your account —
  nothing more is required to use the app.
- Analytics (PostHog, EU region) and marketing email are **opt-in**,
  off by default, and separate from the required terms you accept to
  use the app. We never sell your email address.
- Deleting your account permanently removes all your entries and your
  account record, and purges your analytics data too — full deletion,
  not a soft "deactivate."

## Framework overview

The app is being rebuilt from Wix onto Cloudflare:

- **Frontend** — [React](https://react.dev) + [React Router](https://reactrouter.com),
  built with [Vite](https://vitejs.dev), deployed on
  [Cloudflare Pages](https://pages.cloudflare.com/). Chosen over a plain
  static site because a React Native mobile app is planned soon after —
  React on web now means shared patterns (and a shared API client/types
  package) rather than a rewrite later.
- **API** — a [Cloudflare Worker](https://workers.cloudflare.com/)
  using [Hono](https://hono.dev) for routing, handling auth and all
  data access. This is the one backend both the web app and the future
  mobile app call — no separate "app API," no second data store.
- **Database** — [Cloudflare D1](https://developers.cloudflare.com/d1/)
  (SQLite), storing users, sessions, questions, tasks, and entries.
- **Auth** — Google Sign-In (OAuth 2.0) implemented directly in the
  Worker; no third-party auth vendor, so all account data (including
  deletion) stays in one system. Sessions work as either a browser
  cookie (web) or a bearer token (mobile, ready ahead of the app itself).
- **Analytics** — [PostHog](https://posthog.com) Cloud, EU region,
  loaded only for users who opt in.

Planned repo layout once the rebuild lands (an npm-workspaces monorepo):

```
/worker      — Hono API, D1 schema/migrations, seed content
/shared      — API client + types, shared with the web app now and
               the React Native app later
/web         — Vite + React + React Router site
```

## Status

Design and implementation plan are complete and approved; implementation
has not started yet. See the design spec linked above for the full data
model, API surface, and rollout steps.
