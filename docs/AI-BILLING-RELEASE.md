# AI billing release plan — approval required

## Current state

Feature branch only; production migrations and production publishing are not authorized. Retail credit packs and the subscription catalog remain inactive. The confirmed Stripe account is Runfloorai; authorization granted so far is CLI Test-mode access only. No real customer is charged.

## Rehearsal gates

1. Provision a separate, empty original-RunFloor QA Supabase project. Never copy production tenant exports or Marketing data. Record its project reference before applying anything.
2. Replay historical migrations in that QA environment, then the new CLI-generated `20261114190924_ai_credit_billing.sql`. Fix failures using new migrations where historical migrations are already applied; do not rewrite deployed history.
3. Configure server-only QA Supabase and Stripe Test-mode credentials, trusted QA origin and a dedicated verified webhook endpoint. Do not expose secrets in screenshots, logs, GitHub or public variables.
4. Use synthetic companies and employees to verify real authenticated company isolation, member/billing-admin/platform-owner permissions, simultaneous operations, exhausted balances, uncertainty/reconciliation, monthly cycles, fractional costs, refund debt and model-rate snapshots.
5. Approve only an explicitly labeled temporary Test-mode pack for the rehearsal; do not activate live retail pack pricing or expiration. Complete checkout, asynchronous failure/success, webhook duplicates, refund and dispute flows against the app and verify ledger rows. Repeat the $99 monthly subscription cycle and one-location rule.
6. Review desktop/mobile screens, denied-access and unavailable-data states. Re-run all checks and review migration security/performance advisors.

## Exact production approval request to present after rehearsal

Provide the final PR/commit SHA, the original RunFloor Supabase project reference, original Vercel project and production domain, migration list and backups, exact Stripe live account/Price IDs/webhook endpoint, approved pack prices/expiration (if any), subscription/portal cancellation settings and tax handling. Obtain explicit user approval for those named targets and actions before proceeding. This document alone is not approval.

After approval: take database backup; apply only reviewed pending migrations to the named original project; configure its server secrets and webhook; activate the approved price/catalog; deploy the reviewed commit to the named original Vercel project; verify authorized sign-in, ledger, low-credit flow and webhook health. Monitor uncertain reservations and payment failures. Do not publish Marketing as part of this release.

Rollback: disable sales/catalog and pause new AI work while preserving ledger/history; restore the previously approved application deployment only after ensuring it cannot bypass credit accounting. Do not drop ledger tables, reverse settled usage, or restore an old database over confirmed payments. Reconcile in-flight reservations and paid orders first. Recovery adjustments require an audited reason.

## Pending approvals and access

- Hosted subscription checkout completion and Test Clock renewal rehearsal before live recurring sales.
- Explicit retail pack quantities, retail prices and expiration approval before activation.
- Production release targets and named migration/deployment approval.
- Tax/portal cancellation configuration and applicable legal terms remain user decisions; no legal agreement is accepted by this implementation.

## QA environment record

The user approved the $10/month separate Supabase project `runfloor-billing-qa` (`xcjokbopvhwtfzwvkysx`), in the existing Vercel-managed organization, US East. It is independent of the production project and Marketing. QA server credentials were configured privately. Connected authorization, credit accounting, signed payment fulfillment, refunds, cancellation, recovery and desktop/mobile checks passed. Local test servers and privileged sign-in helpers were stopped after verification.

Fresh historical replay revealed pre-existing dependency defects: the training-module category migration sorts before table creation, and the lesson-reordering migration drops an absent constraint. `node scripts/prepare-ai-billing-qa.mjs xcjokbopvhwtfzwvkysx` produces a QA-only bootstrap that reorders those training migrations, adds the historical synthetic organization required by old seed inserts, and makes that one absent-constraint drop conditional. It does not edit old migrations or connect to a database. Supabase confirmation is required to apply its generated SQL to the empty QA database. These historical defects must be reviewed separately before claiming a pristine CLI replay works.


## Applied only to QA

- `20261114190924_ai_credit_billing.sql`
- `20261114202014_ai_billing_service_permissions.sql`
- `20261114203211_ai_checkout_recovery.sql`
- `20261114203546_ai_usage_overage_reconciliation.sql`
- `20261114204438_ai_payment_reversal_ordering.sql`

Additional historical gaps encountered during QA replay: invitation and knowledge-chunk base-table migrations are missing from repository history; training indexes/policy are duplicated; checklist-section composite uniqueness is missing. QA-only reconstructed dependencies and compatibility handling live in `supabase/qa/` and `scripts/prepare-ai-billing-qa.mjs`. They are not production migrations and do not establish that the historical chain is a pristine clone of production. Production schema history must be reconciled before rollout. No applied migration was rewritten.

Repeat connected accounting with `node scripts/verify-ai-billing-connected.mjs` after securely preparing the dedicated QA identity/key files using `scripts/prepare-ai-billing-qa-identities.mjs`. The verifier rejects any other project URL. Generated passwords, tokens and synthetic identity exports remain ignored under `.qa/`.

Security advisors report intentional service-only RLS tables with no client policies and intentionally authenticated, role-checked administration/summary RPCs. An existing `handle_new_user` trigger-function execution warning and unrelated legacy performance advisories remain outside this change; review them with production schema history before rollout. New billing foreign-key indexes were added. No live keys were used.

## Verification record (2026-11-14)

- `pnpm test`: 124 passed, zero failed (36 credit-specific checks included).
- `pnpm test:credits`: 36 passed, zero failed.
- `pnpm lint`: zero errors, 12 pre-existing warnings outside the new billing files.
- `pnpm typecheck` and `pnpm build`: passed.
- Connected QA: authenticated company isolation, hidden provider-cost columns, denied employee purchases and forged reservation RPCs, concurrent reservations with overspend denied, fractional settlement, signed webhook fulfillment, duplicate delivery, partial/full refunds and late paid replay passed.
- Connected subscriptions: concurrent Checkout deduplication, $99 Test-mode activation and billing dates, cancellation, refund-triggered pause, expired Checkout recovery and pending one-location enforcement passed. The recurring subscription was created through the Test API; a hosted subscription form and Test Clock renewal were not exercised.
- Actual customer/admin pages: desktop/mobile checked; purchase button reached Checkout; fractional audited adjustment persisted.
- Test sales/catalog resources deactivated; open test Checkout expired; temporary local helpers/listener stopped. The user rotated the Test-mode key; the replacement was verified against the intended account and saved privately.

The Stripe dashboard also reports paused account capabilities requiring an account-owner task. Resolve the account's requirements, tax handling and portal settings before any live launch. No live resource or legal agreement was activated here.
