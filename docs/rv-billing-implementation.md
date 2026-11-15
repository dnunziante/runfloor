# RunFloor RV release

This release is based on current production commit 3d359d41e74f43b7324179ec9930d8c18c77fcf5, not the older local editing copy. The original prototype report is superseded by this reconciliation.

## Included changes
- $99/month/location RunFloor Complete pricing card, accessible FAQ, Pricing anchors, and free-trial CTAs.
- Supabase email-verified signup, idempotent organization/location activation, a 168-hour UTC trial, one introductory trial per organization and registering user, and a 100-credit shared location allowance.
- Location subscription status, saved/skippable onboarding, trial reminders, expiration/upgrade screen, and additional paid locations without duplicate employee accounts or repeat trials.
- Reuses production ai_credit_grants, ai_usage_requests, ai_credit_allocations, model rates, reservations, settlement, reconciliation, and runfloor_billing_events. No second credit ledger or per-operation cost configuration is deployed. Fractional credits and uncertain-usage handling remain unchanged.
- Legacy companies retain existing organization billing and reset behavior. Trial organizations cannot receive legacy automatic 2,000-credit grants. New reservations and reconciliation are location-scoped. Purchased credit lots are preserved during included-period transitions.
- Reuses the verified Runfloorai Stripe factory and the existing signed /api/stripe/webhook endpoint. Location Checkout uses the existing approved $99 catalog price, explicit payment authorization, and verified invoice-paid allocation. Browser return URLs never grant paid access. Portal configuration must cancel at period end.
- Preserves the newer production Sales/Operations/Executive assistant routes and their tested behavior. Pending knowledge administration, document metadata, source presentation, and isolated pipeline modules are included; the active assistant routes are not reverted to the older local implementation. External Responses/web-search calls remain blocked by the existing metering transport until that request type is approved; no unmetered provider transport is added.

## Migration
supabase/migrations/20261115004649_rv_complete_billing.sql

Adds RV trial/entitlement, onboarding, and reminder metadata; extends existing grants and usage with location_id. Existing rows retain NULL location and their existing accounting behavior. The existing reservation entry point delegates legacy organizations to its unchanged implementation. New companies use the existing model prices and settlement functions.

The migration has passed isolated PostgreSQL tests and a hosted runfloor-billing-qa rehearsal. A rolled-back hosted transaction verified service-role activation, exactly 100 credits, 168-hour duration, no automatic replenishment, and existing reservation/release. No QA fixture or provider charge was retained.

## Configuration
- Existing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and server-only SUPABASE_SERVICE_ROLE_KEY.
- RUNFLOOR_RV_BILLING_ENABLED=true enables the verified trial flow after the migration.
- APP_URL or existing RUNFLOOR_BILLING_ORIGIN is the trusted auth return origin.
- Reuse RUNFLOOR_STRIPE_SECRET_KEY, RUNFLOOR_STRIPE_ACCOUNT_ID and RUNFLOOR_STRIPE_WEBHOOK_SECRET.
- RUNFLOOR_STRIPE_LIVE_ENABLED remains false/unset. No live billing is authorized by this release.
- The existing runfloor_billing_catalog must be explicitly approved/activated with the real $99 USD monthly price before paid sales. This deployment does not activate it.
- STRIPE_RV_PORTAL_CONFIGURATION_ID must identify an active configuration with cancel-at-period-end and plan/quantity changes disabled before the location portal is offered.
- Supabase email confirmation and allowed auth callback URLs must be configured. LOCAL_DEMO_MODE must not be enabled for actual signup tests.

## Remaining limitations
- Live Stripe sales, account requirements, tax registration/collection decisions, hosted subscription payment/renewal tests, and portal setup remain separate launch steps. No Stripe product, price, customer subscription, or live credential is activated by deploying this code.
- Existing credit-pack products remain inactive. Legacy pack functionality is preserved; new location-scoped pack ordering requires approved pack configuration and fulfillment extension before sales. No pack prices were invented.
- Trial reminders are in-app on visits, not outbound emails. No email provider was added. Auth verification email uses existing Supabase Auth.
- Organization name normalization and one-claim constraints are introductory abuse controls, not external legal/business identity verification.
- The published copy and configured trial path must be smoke-tested after release. No email delivery or actual subscription charge is claimed by the database tests.

## Verification
- Merged suite: 160 tests passed, including existing provider/billing/webhook tests and new trial policy tests.
- New integrated SQL harness: passes exact trial grant, stable costs, shared employee deductions, competing reservations, duplicate protection, location isolation, expiry, monthly grant deduplication, purchased-credit preservation, scheduled cancellation, and legacy access.
- TypeScript: passes.
- Hosted QA migration and rollback rehearsal: pass.
- Windows local Turbopack build is blocked by denied junction creation for pdf-parse. Vercel's hosted build must be READY before production is reported successful.
- QA advisors: the new rv_trial_claims table intentionally has no client policy; only service-role provisioning uses it. Other reported auth/admin advisories predate this release.

## Main source files
src/components/rv-pricing.tsx and .css; src/app/page.tsx; src/app/signup/**; src/components/trial-signup-form.tsx; src/app/billing/**; src/components/rv-trial-status.tsx; src/components/rv-billing.css; src/lib/billing/{policy,data,stripe,webhook}.ts; src/lib/ai-billing/provider.ts; src/app/api/stripe/webhook/route.ts; src/app/ai-usage/page.tsx; src/proxy.ts; scripts/test-rv-billing.mjs; the migration above. Existing pending knowledge management components and tests are also included, while newer remote product and billing changes are preserved.
