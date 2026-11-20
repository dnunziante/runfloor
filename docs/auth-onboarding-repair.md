# Authentication and onboarding repair — pre-production review

Status: code repair prepared on `fix/auth-onboarding`; no production deployment or database/auth configuration changes performed.
Repository: dnunziante/runfloor. Base main: 574eb1a2ecf131611fac48aabf5ce98f51c9abef, matching commandly-rho.vercel.app at investigation time.

## Evidence and causes

- The callback only exchanged PKCE `code` values. Default Supabase invitation links return an implicit session in the URL fragment, which the server cannot read. The callback redirected before creating an SSR cookie session; `/auth/accept` then redirected to login.
- Production Auth logs contain `user_invited` (HTTP 200), followed by an implicit login, an expired/used token error, and `user_repeated_signup` (HTTP 200) for that same account. Repeated signup success is not evidence that a new email was sent. There were zero unconfirmed users at inspection time. No SMTP delivery failure was established from the inspected logs; new-user delivery remains unverified.
- Signup always claimed an inbox verification link was forthcoming, including concealed duplicate-account success responses. Delivery failures already returned a generic error, but the UI did not distinguish rate limits or mail-service failures.
- Signup used APP_URL for the return destination, while its PKCE verifier cookie belonged to the host where registration started. Registration on the legacy alias can therefore lose its verifier when returning to the canonical host.
- The invitation password action updated credentials before checking whether a valid workspace invitation still existed.

## Scoped repairs

- Keep PKCE exchange; add token-hash verification and a browser completion page for existing fragment-based invite/recovery emails. Validate the resulting user with Supabase before entering onboarding. No local JWT decoding is used to trust an identity.
- Clear token fragments from browser history immediately, use no-referrer on the completion page, reject external redirect destinations, and expose an actionable invalid-link page.
- Use configured HTTPS APP_URL for invitation callbacks, and render production signup on its canonical host to keep PKCE cookies and confirmation callbacks together.
- Before showing or saving the invitation password, use a server-only lookup scoped to the verified Auth user ID/email, pending status, and expiry, rejecting suspended membership. The existing authoritative invitation RPC still assigns membership and preserves current administrator decisions.
- Surface signup rate-limit, unauthorized-email and service failures without claiming delivery; use privacy-preserving wording for duplicate/eligible registrations. Do not look up email existence to reveal accounts.
- Keep existing verified-user trial activation RPC; it grants exactly 100 credits for 168 hours. No payment method or Stripe call is required.

## Test results

- Full unit/database suite: 258 tests passed (includes new callback, browser session, invitation password, pending lookup and real invitation SQL regression tests).
- `pnpm test:billing-db`: passed. Exact 100-credit/168-hour trial, idempotent activation, credit isolation, expiry and legacy-access coverage.
- `pnpm typecheck`: passed after regenerating stale development route types alongside the production build.
- `pnpm lint`: passed with 12 pre-existing warnings, zero errors.
- Built-app HTTP smoke: passed for completion/error pages, fragment callback handoff, invalid-link redirect and canonical production signup redirect.
- `pnpm build`: passed. Existing metadataBase warnings remain.
- The invitation SQL regression runs the actual checked-in acceptance function against an isolated PGlite database: wrong email, expired invitation, suspended membership and reuse are rejected; current role/location are preserved; no additional membership is created by replay.
- Provider interactions in callback/password action tests are mocked. They do not demonstrate real Supabase email transport, browser-to-provider exchanges, or inbox delivery.

## Requested live checks still blocked

| Requested check | Status |
| --- | --- |
| Brand-new trial account, email arrives, confirmation link creates session | Not run: two dedicated test inboxes and live test environment/auth settings access are needed |
| 7-day trial / 100 credits / no payment | Passed in isolated database, not yet through a real new-user email flow |
| Separate employee receives invite, sets password, accesses intended dealership | Server/session and actual membership SQL tests pass; live email/browser flow not yet run |
| Expired and previously used invitation links | Automated callback/action/SQL rejection tests pass; real mailed links not yet tested |
| Existing users and memberships | Regression tests pass; production was read only and no production membership was mutated |
| Supabase Site URL / allowed redirects / email templates / SMTP | Dashboard is behind sign-in; connector has no Auth-settings read/update tool |
| Vercel production Supabase project values | APP_URL is https://commandly-rho.vercel.app; RV trials enabled, live Stripe disabled. Supabase URL/key/service-role variables exist, but Vercel marks them sensitive and omits their values. Exact project match cannot be verified through that response |

Original RunFloor database is documented as cqwcagnrgxokbrswhbfj (Refyntra); production Auth activity is present there. Do not substitute runfloor-marketing or the billing QA database for production.

## Remaining pre-deployment procedure

1. Sign into the original Supabase project dashboard and inspect Auth URL Configuration, Email templates, SMTP provider and send limits. Preserve email confirmation. Set Site URL to the production canonical origin and allow the exact callback destinations with their query strings; preserve any still-needed trusted legacy URLs. Do not add broad wildcards.
2. Verify the hidden Vercel production Supabase URL, publishable key and service-role key belong to that same project. Do not put service keys into public variables or source.
3. Use two separate controlled test inboxes and an isolated test dealership. Test the reviewed code against a deliberately configured non-production environment; inspect the received email and final browser session, trial grant and dealership/role.
4. Capture provider delivery evidence; a successful signup API response is only acceptance, not inbox delivery. If SMTP rejects, repair the provider configuration, then repeat with a fresh controlled account.
5. Re-test replay and expiry with real links, report all outcomes, then review deployment. Do not merge or deploy production while these checks remain incomplete.

Supabase official reference: https://supabase.com/docs/guides/auth/auth-email-templates (SSR fragment behavior and token-hash verification).
