# Sales Solo rollout

Sales Solo reuses Admin, Manager and Sales roles. The account subscription is an independent ceiling: a role or permission edit cannot unlock Operations, Executive, coaching, additional users, location assignment, or credit purchases. The verified owner is created as Admin. Existing customer accounts are not enrolled by these migrations.

The subscription is USD 25 per month for one user. Every metered AI call, including document processing, background work and Solo Help AI, shares a USD 5 actual provider-cost allowance. Integer accounting uses 100,000,000 units per dollar. Reservations serialize by account and spend only the current paid Solo grant; purchased or legacy grants cannot extend it. Uncertain requests retain their reservation. Existing settlement reconciles actual usage and approved model rates. No allowance rolls over.

## Before enabling registration

1. Apply the three Sales Solo migrations to the intended application database after rehearsing them in QA. No Marketing database or deployment is involved.
2. Configure the existing Stripe connection in the correct environment: RUNFLOOR_STRIPE_SECRET_KEY, RUNFLOOR_STRIPE_ACCOUNT_ID, RUNFLOOR_STRIPE_WEBHOOK_SECRET and RUNFLOOR_BILLING_ORIGIN. Test credentials must use the isolated QA database and test mode; never mix test subscriptions with production customer records.
3. Set the singleton sales_solo_catalog to the independently verified product, USD 2500 licensed monthly price, Stripe account and matching livemode. Activate only the approved catalog. Leave the Complete catalog unchanged.
4. Configure STRIPE_SOLO_PORTAL_CONFIGURATION_ID with cancellation at period end enabled and generic subscription/quantity updates disabled. The existing explicit upgrade action performs a paid, pending-if-incomplete change to the approved Complete price after Platform Admin provisions a location.
5. Subscribe the signed existing webhook endpoint to checkout.session.completed, customer.subscription.created/updated/deleted, invoice.paid and invoice.payment_failed. Only an independently retrieved, paid latest subscription invoice can grant a period. Checkout return parameters grant no access. Verify signature, account and test/live mode.
6. Complete actual test checkout, renewal, failed payment, cancellation and upgrade using Stripe test mode, then desktop and mobile browser acceptance. Confirm profile and material saves survive reload, and non-AI tools remain usable at the AI cap.
7. Enable RUNFLOOR_SALES_SOLO_ENABLED only after those checks pass. This flag controls new registrations; existing enrolled accounts always retain commercial enforcement independently of the flag.

## Verification

`npm test` includes actual PostgreSQL migrations in PGlite, webhook invoice validation, all-role proxy checks, and background accounting. Run `npm run lint`, `npm run typecheck` and `npm run build`. Hosted QA must additionally verify real Auth/RLS, simultaneous reservations and actual Stripe lifecycle delivery. Local fixtures are not evidence that hosted checkout or mobile layout passed.

Platform Administration > AI Billing shows account plan, subscription status, users, provider cost spent/reserved/remaining and paid-through date. Only Platform Admin can save a reasoned override; the database records the actor and values in ai_billing_audit. Limits cannot be reduced below existing users or spent/reserved cost.

## Current test setup

Stripe test product: prod_VeFKMoUkNPcli5. Monthly test price: price_1UcwpiGPqrVHSJaAP5ODvjpr. Test mode only. Do not copy these identifiers into a live catalog.

Hosted QA project: runfloor-billing-qa (xcjokbopvhwtfzwvkysx). Disposable account and synthetic subscription fixtures are isolated there. Synthetic events test the ledger; they do not prove Stripe webhook delivery. Never commit QA passwords or server keys.
