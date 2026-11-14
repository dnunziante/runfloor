# AI credits and billing

This implementation belongs exclusively to `dnunziante/runfloor`. No Marketing application, database, Stripe configuration or deployment is used.

## Approved product rules

- One RunFloor subscription: USD $99/month, one active location, unlimited users, 2,000 included AI credits. No annual purchase or free trial is configured.
- Included credits are company-wide, reset without rollover, and are spent before purchased credits. Legacy companies use an administrator-selected monthly UTC reset day (1–28). Linked active subscriptions use Stripe billing-period dates; an existing unexpired allowance completes before another is minted.
- One credit represents $0.01 underlying AI cost. Internal accounting uses 1,000,000 units per credit and 100,000,000 units per dollar. Each request rounds only to a microcredit, never a whole credit.
- Purchased credits carry forward. No retail packs or expiration policies are seeded or activated. Draft quantity, retail price and expiration require a separate audited administrator approval.
- Platform administrators configure company allowances, reset days, warning percentages (75/90 initially), billing administrators, versioned rates, pack drafts, credit adjustments and uncertain-usage reconciliation.

## Accounting and authorization

`provider.ts` is the sole OpenAI transport. Before sending a bounded operation, it resolves the signed-in active workspace, rejects demo mode, chooses a configured exact model rate, and calls `reserve_ai_usage` using the server-only Supabase client. SQL independently rechecks membership. A company advisory transaction lock serializes every grant, reservation, settlement and payment operation.

Lots track included, purchased and adjustment balances. Reservations allocate included lots first, then purchased/adjustment lots by expiration. Refunds can leave negative available balances when credits were already consumed; subsequent operations cannot spend through that debt. Requests retain immutable pricing-version IDs and separate actual provider cost from customer credits charged. Current charging is at underlying cost with no markup; retail pack prices are independent.

Usage settlement reads provider-reported prompt, cached input, output and reasoning tokens. Reasoning is already part of output and is not added twice. Provider failure, unreadable response or absent usage retains a reservation for audited review. Explicit unbilled client/rate-limit rejections release it. Actual usage above the reservation freezes AI pending review. There are no automatic provider retries. Each new billable attempt requires a new reservation.

Stable `x-runfloor-ai-request` UUIDs prevent replay charging for assistant requests; the same request ID is rejected rather than resending. An active prompt hash blocks matching concurrent/uncertain requests even without a client ID. Hashes contain no retained prompt text. Distinct later user attempts without a reused client ID are separate operations. No uncertain reservation is automatically expired: confirm actual provider billing before settling or releasing it.

All tenant credit tables have RLS. Ordinary users can read their own sanitized usage rows; billing administrators and tenant administrators can view company details and purchase. Company summary is shared. Provider costs, raw token evidence, rates and audit controls are platform-only. Credit mutation RPCs are service-only; platform administration RPCs check platform-owner identity and audit reason. Company isolation and column permissions are exercised against actual PostgreSQL using PGlite.

AI exhaustion pauses AI requests, leaving other authorized application features available. Current bounds reserve up to 8,192 output tokens and conservative input bytes/overhead, capped at 200,000 input units to avoid long-context price tiers. Remote image references and oversized documents fail before provider dispatch; split oversized material. Unsupported model overrides fail closed until an administrator adds verified pricing.

## Customer and platform screens

`/ai-usage` shows included, used, included remaining, total available, reserved and purchased balances, period/reset dates, warning notices, date/employee/feature filters and paginated history. Missing or malformed summary data shows an unavailable state, never an invented balance. Purchase and portal controls require company billing privileges.

`/admin/ai-billing` is restricted to platform owners. Changes need an audit reason. Uncertain reconciliation requires verified provider usage or provider confirmation that nothing was billed. A subscription refund/dispute pauses AI for review; other tools remain available. An administrator must assess the outcome and make an audited unpause decision.

## Stripe integration and configuration

Confirmed intended account: Runfloorai, `acct_1MC551GPqrVHSJaA`. Never reuse Marketing secrets or webhook endpoints. Server environment variables:

- `RUNFLOOR_STRIPE_SECRET_KEY`: dedicated Test-mode key in QA; live key only after release approval.
- `RUNFLOOR_STRIPE_ACCOUNT_ID`: expected account ID, verified through Stripe before using it.
- `RUNFLOOR_STRIPE_WEBHOOK_SECRET`: signing secret for this environment's endpoint.
- `RUNFLOOR_BILLING_ORIGIN`: trusted HTTPS application origin (localhost allowed in QA).
- `RUNFLOOR_STRIPE_LIVE_ENABLED`: leave unset/false in QA; explicitly true only for approved live release.
- `SUPABASE_SERVICE_ROLE_KEY`: original RunFloor environment's server-only key. Never expose as NEXT_PUBLIC.

Checkout snapshots pack quantity, price and expiration. Payment must be verified by a signed webhook and retrieved Stripe state before SQL grants credits. The checkout return page merely says verification is pending. SQL verifies account, mode, amount, currency, order, customer association and session, deduplicates events and purchase grants, and processes delayed success/failure, refunds and disputes. Subscription checkouts share a durable company slot and Stripe idempotency key. Expired checkouts are recovered with a compare-and-delete slot only after Stripe confirms a terminal state and no active or pending subscription. An unconfirmed checkout older than the Stripe idempotency window requires administrator review. Do not simply delete a pending slot: verify the Stripe session and absence of an active/pending subscription first.

Webhook URL: `/api/stripe/webhook`. Subscribe to checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, checkout.session.expired, customer.subscription.created/updated/deleted, invoice.paid, invoice.payment_failed, charge.refunded and charge.dispute events. Webhook API version must match the pinned Stripe SDK. Customer portal configuration must support only the approved plan and intended cancellation behavior. Review sales-tax obligations and portal policy before live release; this change does not register taxes or accept legal terms.

## Verification and operating limits

Run `pnpm test:credits`, `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`.

The isolated SQL harness replays all five billing migrations against minimal auth/membership/location dependencies. A separate connected Supabase QA rehearsal also passed, with the legacy-history compatibility changes documented in the release plan. Real authenticated customer and platform screens were manually checked on desktop and mobile. A fractional administrator adjustment was saved through the actual page and appeared in the audit trail. No sample balances are introduced into the product.

Connected Stripe verification passed: hosted $1 test payment → signed notification to the actual local Next.js route → one 100-credit grant in QA Supabase; duplicate delivery did not duplicate credits. Partial and full refunds revoked 50 and 100 credits respectively. A late paid-event replay preserved the refund. The actual usage-page Buy button opened authorized Checkout. Concurrent subscription Checkouts deduplicated; a $99 Test-mode subscription activated, synced billing dates, canceled, and was refunded. The subscription refund paused AI for audited review. Expired checkout recovery and the pending one-location limit passed. All temporary test sales were deactivated afterward; no real charge was made.

Provider usage/failure tests use deterministic responses, without billable OpenAI traffic. Asynchronous failures and disputes are covered by handler/accounting tests, rather than an actual bank dispute. The hosted subscription payment form and renewal via Stripe Test Clocks still need a separate rehearsal before live sales. Stripe testing used the user-approved shared Test mode, not a dedicated Stripe sandbox. The replacement Test-mode key was verified and saved privately after user rotation.

See [AI inventory](AI-INVENTORY.md) and [release checklist](AI-BILLING-RELEASE.md).
