// Types the `env` exported by `cloudflare:test` as the Worker's real Env, so
// tests are typechecked against the same bindings the Worker uses.
// This is the pattern documented by @cloudflare/vitest-pool-workers.
import type { Env } from '../src/types';
import type { D1Migration } from '@cloudflare/vitest-pool-workers/config';

declare module 'cloudflare:test' {
  interface ProvidedEnv extends Env {
    // Test-only binding injected by vitest.config.ts for applyD1Migrations().
    TEST_MIGRATIONS: D1Migration[];
  }
}
