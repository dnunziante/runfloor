# Three-plan pricing and signup release

Scope: original `dnunziante/runfloor` only. Includes the existing reviewed-by-tests Sales Solo QA foundation (commits 9f32826, 0073a41, c35b98c), plus the three-plan landing page and signup links. RunFloor Marketing is excluded.

## Advertised plans and actual access

| Plan | Monthly price | Access | Included AI credits |
| --- | --- | --- | --- |
| RunFloor Free | $0 | One personal account; shared RV reference model library, comparisons, own profile and static Help | 0; all AI blocked |
| RunFloor Solo | $25 | One personal Sales workspace after verified payment; sales AI, own products/documents/templates, quotes and messaging | 500 each paid month |
| RunFloor Complete | $99 per dealership location | Existing Complete lifecycle, unlimited users, Sales, Operations and Executive tools | 2,000 shared monthly credits; existing 7-day trial has 100 |

All three display “Preloaded with over 1,500 models.” A read-only production count on 2026-11-18 confirmed **3,273** rows in the enabled, public-demo-visible, non-internal RV template. These are reference specifications, not dealership-owned inventory or availability. The additional shared-reference migration and `/products?catalog=shared` link make that same library accessible to authorized Complete RV members and paid Solo members without copying models into customer accounts. Search, filter, pagination and selected comparison models preserve the shared-catalog context. Shared product guides are read-only.

Public aliases `/signup?plan=free`, `/signup?plan=solo`, and `/signup?plan=complete` select the appropriate existing server plan keys. Email-verification redirects preserve that selection across devices. Unknown submitted plan keys are rejected. Activation still verifies the authenticated, confirmed-email owner on the server and enforces the existing database rules. No plan selection grants a paid allowance.

Customer-facing Solo balances use credits with up to six decimal places; underlying cost remains available to platform administrators. 1 credit represents 1,000,000 accounting units. No per-request whole-credit rounding is introduced.

## Explicit commercial gap

Live Stripe charges remain OFF. Solo registrations have effective Free access until a verified paid period is granted. The landing page, FAQs, signup and Billing explain this. No live product/price or subscription is created by this release. Existing Complete pricing, trial length, customer records and billing catalog are preserved. No paid Solo acceptance test or real payment is claimed by this landing-page change. Enabling live Solo sales remains a separate approved release, including Stripe lifecycle acceptance and portal configuration.

The saved prototype's Free AI suggestion was superseded by the owner's explicit instruction that Free includes no AI. Free is intentionally limited to the shared model library and non-AI comparisons; it does not advertise paid Sales tools as free.

## Production release plan — approval required for database changes

Do not merge this backend-dependent release into production before approval of this exact plan. The earlier landing-page deployment authorization did not list these account-access migrations.

1. Confirm the latest production backup is restorable and record its timestamp. Verify target database **cqwcagnrgxokbrswhbfj** (original RunFloor), not Marketing or QA.
2. Apply these committed migrations, in this order, to original RunFloor only:
   - `20261117160000_sales_solo.sql`
   - `20261117161000_sales_solo_events.sql`
   - `20261117162000_sales_solo_hardening.sql`
   - `20261118022850_sales_solo_free.sql`
   - `20261118030001_solo_free_catalog_guards.sql`
   - `20261118165309_shared_rv_reference_catalog.sql`
3. Confirm RLS and RPC permissions, existing-company access, and inactive Solo catalog. Do not enroll or reprice existing accounts. Keep `RUNFLOOR_STRIPE_LIVE_ENABLED=false`; do not configure live Solo prices, keys or portal settings.
4. On the original RunFloor and Commandly Demo deployment projects, enable only `RUNFLOOR_SALES_SOLO_FREE_ENABLED=true` and `RUNFLOOR_SALES_SOLO_ENABLED=true` for registration after migrations. These registration flags do not activate Stripe or paid entitlements. Keep each project's existing database connection and Complete settings.
5. Merge the exact reviewed PR head, let every Git-connected original RunFloor deployment finish, and verify `https://refyntra-demo.vercel.app` and `https://commandly-rho.vercel.app`: pricing, three signup selections, Complete trial copy, and public demo. Confirm Marketing has not changed.
6. If application smoke checks fail, roll application traffic back to the previous known-good deployment and disable new registration. Preserve additive schema and customer data; do not delete tables or reverse ledger history during rollback.

## Verification record

- QA database: `xcjokbopvhwtfzwvkysx`, isolated from production. The five Solo migrations were already rehearsed there; this change also applies the shared-reference follow-up to QA.
- PostgreSQL/PGlite tests cover Free no-AI, direct Data API writes, tenant isolation, membership and location ceilings, paid invoice validation, monthly grants, fractional usage, reservations, failures, duplicate grants, cancellation and upgrade boundaries. Added coverage authorizes Complete RV catalog members while rejecting non-RV and nonmembers.
- Browser: desktop (1280 px) has three columns; mobile (390 px) stacks cards; no horizontal overflow; FAQs follow cards. Clicked all three pricing signup links and confirmed their selected plan. Activated one synthetic, verified-email Free account through the real QA application form; it loaded the shared catalog and redirected attempted AI and Operations access to Billing. No email was sent and no payment was attempted.
- QA Supabase security advisors reviewed. Existing trigger/advisory notices remain; the catalog RPC retains its existing authenticated/service-only ACL and explicit membership/visibility/rate checks. No new anonymous table or RPC access is introduced.
- Local QA identities, keys, logs and helper scripts are ignored under `.qa`; none are committed.

Final local checks (2026-11-18): `pnpm test` **235 passed, 0 failed**; `pnpm lint` **0 errors, 12 pre-existing warnings**; `pnpm build` **passed**; `pnpm typecheck` **passed**. No production migrations or production deployments have been performed by this change.
