import { createApiClient } from '@eve-colors/shared';

// Rough prototype — hardcode dev values here. Update for each deploy target
// (local dev vs. the real api.<domain> once DNS is live).
export const API_BASE = 'http://localhost:8787';
export const POSTHOG_EU_PROJECT_KEY = 'REPLACE_WITH_POSTHOG_PUBLIC_KEY';

export const apiClient = createApiClient({
  baseUrl: API_BASE,
  requestInit: { credentials: 'include' },
  onUnauthorized: () => {
    if (window.location.pathname !== '/') window.location.href = '/';
  },
});
