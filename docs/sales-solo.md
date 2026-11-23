# Sales Solo rollout

Sales Solo reuses Admin, Manager and Sales roles. The account subscription is an independent ceiling: a role or permission edit cannot unlock Operations, Executive, coaching, additional users, location assignment, or credit purchases. The verified owner is created as Admin. Existing customer accounts are not enrolled by these migrations.

The subscription is USD 25 per month for one user. Every metered AI call, including document processing, background work and Solo Help AI, shares a USD 5 actual provider-cost allowance. Integer accounting uses 100,000,000 units per dollar. Reservations serialize by account and spend only the current paid Solo grant; purchased or legacy grants cannot extend it. Uncertain requests retain their reservation. Existing settlement reconciles actual usage and approved model rates. No allowance rolls over.

## Before enabling registration

1. Apply the current Sales Solo migrations to the intended application database after rehearsing them in QA. The checkout-first signup migration allows an intent to exist before an account does and records the checkout email; the account is linked only after Stripe reports a successful first payment. No Marketing database or deployment is involved.
2. Configure the existing Stripe connection in the correct environment: RUNFLOOR_STRIPE_SECRET_KEY, RUNFLOOR_STRIPE_ACCOUNT_ID, RUNFLOOR_STRIPE_WEBHOOK_SECRET and RUNFLOOR_BILLING_ORIGIN. Test credentials must use the isolated QA database and test mode; never mix test subscriptions with production customer records.
3. Set the singleton sales_solo_catalog to the independently verified product, USD 2500 licensed monthly price, Stripe account and matching livemode. Activate only the approved catalog. Leave the Complete catalog unchanged.
4. Configure STRIPE_SOLO_PORTAL_CONFIGURATION_ID with cancellation at period end enabled and generic subscription/quantity updates disabled. The existing explicit upgrade action performs a paid, pending-if-incomplete change to the approved Complete price after Platform Admin provisions a location.
5. Subscribe the signed existing webhook endpoint to checkout.session.completed, customer.subscription.created/updated/deleted, invoice.paid and invoice.payment_failed. Only an independently retrieved, paid latest subscription invoice can grant a period. Checkout return parameters grant no access. Verify signature, account and test/live mode.
6. Complete actual test checkout, renewal, failed payment, cancellation and upgrade using Stripe test mode, then desktop and mobile browser acceptance. Confirm profile and material saves survive reload, and non-AI tools remain usable at the AI cap. Confirm a new Solo buyer is sent to Stripe before account creation; after payment, verify account creation, email confirmation and webhook workspace provisioning.
7. Enable RUNFLOOR_SALES_SOLO_ENABLED only after those checks pass. This flag controls new registrations; existing enrolled accounts always retain commercial enforcement independently of the flag.

## Verification

`npm test` includes actual PostgreSQL migrations in PGlite, webhook invoice validation, all-role proxy checks, and background accounting. Run `npm run lint`, `npm run typecheck` and `npm run build`. Hosted QA must additionally verify real Auth/RLS, simultaneous reservations and actual Stripe lifecycle delivery. Local fixtures are not evidence that hosted checkout or mobile layout passed.

Platform Administration > AI Billing shows account plan, subscription status, users, provider cost spent/reserved/remaining and paid-through date. Only Platform Admin can save a reasoned override; the database records the actor and values in ai_billing_audit. Limits cannot be reduced below existing users or spent/reserved cost.

## Current test setup

Stripe test product: prod_VeFKMoUkNPcli5. Monthly test price: price_1UcwpiGPqrVHSJaAP5ODvjpr. Test mode only. Do not copy these identifiers into a live catalog.

Hosted QA project: runfloor-billing-qa (xcjokbopvhwtfzwvkysx). Disposable account and synthetic subscription fixtures are isolated there. Synthetic events test the ledger; they do not prove Stripe webhook delivery. Never commit QA passwords or server keys.


## Sales Solo Free

Free is a permanent one-user account with no subscription, payment card or AI grant. The owner is the existing Admin role; a separate commercial policy permits only shared catalog browsing, non-AI comparisons, own profile/password, static Help and upgrade billing. Canceled or expired paid Solo accounts use the same effective Free access without deleting their paid records. Complete accounts keep their existing lifecycle.

The authorized source is the existing RV industry template catalog, already marked enabled, public-demo-visible and not internal-only. Free never reads tenant inventory, documents or dealer-specific pricing. A restricted RPC returns only approved template fields. No catalog records are copied per account. Inventory reads are paginated at 48 rows; comparison options are bounded and retain at most three explicit selections plus fallback models. Search and brand/category/year filters run on the server. Shared reads cache for 60 seconds after an authenticated authorization/rate check; direct RPC reads are limited to 120 per user per minute. Revoking public visibility blocks subsequent access checks even if a cached result exists.

Free blocks AI at the provider wrapper, database reservation entry point, Help provider, upload handlers, document-processing preflight and routes. A paid checkout return or failed invoice never grants access or allowance. Only a verified paid latest invoice atomically converts Free to paid Solo and creates the existing $5 monthly grant. Platform role changes cannot bypass the plan. Only Platform Admin can override seat limits, with an audit; Free AI remains zero.

Apply the Free migration and catalog guard follow-up after the paid Solo migrations. RUNFLOOR_SALES_SOLO_FREE_ENABLED defaults false and must remain false until actual browser signup, desktop/mobile and Stripe acceptance checks pass. The existing Solo QA branch has preview-only database overrides; production credentials and provider/Stripe secrets are not used there. Do not turn on registration or describe browser/payment checks as passed based on API or synthetic-event tests.

No AI cost is incurred by Free's permitted paths. Authentication, database queries, server execution and traffic still use the existing hosting allowance and can incur operating costs. There is no separate infrastructure per free account.
