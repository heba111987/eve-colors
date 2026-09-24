// Guards `npm run deploy` against silently shipping a build pointed at
// lib/config.ts's localhost fallback. Mirrors the .env file precedence Expo
// itself uses (@expo/env) so this agrees with what `expo export` will
// actually see — a plain `process.env` check would miss EXPO_PUBLIC_API_URL
// set via client/.env rather than a real shell export.
const ENV_FILES = ['.env', '.env.local', '.env.production', '.env.production.local'];

for (const file of ENV_FILES) {
  try {
    process.loadEnvFile(file);
  } catch {
    // Missing file is fine — Expo's own loader skips these too.
  }
}

if (!process.env.EXPO_PUBLIC_API_URL) {
  console.error(
    'EXPO_PUBLIC_API_URL must be set before deploying — add it to client/.env, e.g.\n' +
    '  EXPO_PUBLIC_API_URL=https://api.evecolors.com\n' +
    'or export it for this command:\n' +
    '  EXPO_PUBLIC_API_URL=https://api.evecolors.com npm run deploy\n' +
    'Otherwise the build silently falls back to http://localhost:8000 (lib/config.ts).',
  );
  process.exit(1);
}
