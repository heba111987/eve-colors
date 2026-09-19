import type { SessionUser } from '@eve-colors/shared';
import { POSTHOG_EU_PROJECT_KEY } from './api';

let loaded = false;

export function loadPostHogIfConsented(user: SessionUser | null | undefined) {
  if (loaded || !user || !user.analyticsMarketingConsentAt) return;
  loaded = true;

  const script = document.createElement('script');
  // Values interpolated into this script's source MUST go through
  // JSON.stringify — string interpolation into an inline <script> is a
  // classic injection vector (a security review flagged the raw-template
  // version of this loader during Task 18's implementation), even though
  // user.email nominally comes from Google's own ID token.
  script.textContent = `
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on identify getGroups".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
    posthog.init(${JSON.stringify(POSTHOG_EU_PROJECT_KEY)}, { api_host: 'https://eu.i.posthog.com' });
    posthog.identify(${JSON.stringify(user.email)});
  `;
  document.head.appendChild(script);
}

// Called when a user revokes analytics consent from /account. Stops an
// already-injected PostHog instance from continuing to capture events for
// this browser tab — closing the gap where the `loaded` flag above only
// prevents re-injection, not continued capture by an instance that already
// loaded under an earlier (now-revoked) consent.
export function stopPostHogTracking() {
  const posthog = (window as unknown as { posthog?: { opt_out_capturing?: () => void } }).posthog;
  posthog?.opt_out_capturing?.();
}
