// No content of its own — this route exists only so `expo export` emits a
// real index.html for Cloudflare's static-asset host to serve at "/" (and,
// with wrangler.jsonc's not_found_handling: "single-page-application", as
// the fallback for any unmatched path). AuthGate in ../_layout.tsx already
// redirects every "/" case (signed-out, signed-in-unconsented, signed-in)
// before this would ever render anything visible.
export default function Index() {
  return null;
}
