# Opal and the RunFloor Help Center

## Preview

Run this from the RunFloor checkout:

```powershell
$env:OPAL_LOCAL_PREVIEW='true'
$env:LOCAL_DEMO_MODE='true'
npm run dev -- --hostname localhost --port 3101
```

Open http://localhost:3101/help and http://localhost:3101/admin/opal.
This development-only preview uses a synthetic owner and isolated .opal-preview files. It is disabled whenever NODE_ENV is production. No dealership records or production database credentials are needed. Do not expose a development preview publicly.

## Implemented

- Persistent, page-aware Ask Opal panel, approved portrait, mobile layout, keyboard focus, Escape, background inert state, new conversation, workspace/sign-out reset.
- Searchable category library, direct guides, related guides, Ask about this guide.
- Fourteen source-verified guides and thirty-eight unpublished planning topics. Publication is not a claim that all underlying business flows have been tested end to end. Unverified workflows remain drafts.
- Owner-only editing, drafts, article preview, explicit verified publication, archival, and previous-version loading as a new draft.
- Safe guide retrieval and server-generated citations. No tenant knowledge search, operational repository, executive repository, or write tools.
- Fixed support mailbox with user-reviewed mail drafts and optional conversation inclusion.
- Separate platform-help token usage, database-backed per-user/global request caps, controlled-topic feedback/attention queue, no stored chat transcripts.

## Production configuration — not applied

Review and test the additive migration 20261116003658_opal_help_center.sql before deployment. No production migration or deployment was run.

Optional dedicated OPAL_OPENAI_API_KEY, otherwise existing OPENAI_API_KEY, is called through Opal's own bounded provider module, never the dealership credit wrapper. OPAL_MODEL defaults to the app's existing gpt-5-mini family. Configure a provider-side budget on the selected account before rollout. Separate token usage is recorded in opal_platform_usage; no currency estimate is presented as an actual charge.

Without a provider key, or on provider failure, Opal returns the closest authorized verified guide. It labels that response as guide-based. Search and support work without AI. A live AI provider call was not exercised in the local preview; mocked tests cover the request contract.

Production articles and history live in opal_article_versions. Published versions are unique per slug. Editing a published article creates a draft; archived versions cannot be retrieved by ordinary members. Publishing/archiving is transactional and serialized per slug. Both database policies and server retrieval restrict roles. Owner privileges use the existing private.is_platform_owner() helper, not user-editable metadata.

Events contain only controlled topic labels, article references, helpfulness, authenticated user ID, and timestamp. They contain no raw questions or responses. Request processing prunes events and usage older than 90 days and rate-limit rows older than a day. If no new requests occur, run equivalent scheduled cleanup before promising a strict deletion deadline. Event retention is not indefinite by design, but an independent scheduled cleanup remains a rollout prerequisite.

Request caps: 10 per user/minute, 100 per user/day, 10,000 platform-wide/day. These cap calls, not currency. Limits fail closed when unavailable. Opal is exempt from subscription gating but still requires authenticated workspace access. It stays independent from dealership AI balances, including zero-credit accounts.

## Verification

Run npm run test:opal, npm test, npm run lint, npm run typecheck, and npm run build. Also run node scripts/opal-preview-smoke.mjs while the isolated preview is running. The smoke script refuses non-local targets and restores article data after its checks.

Database tests run the migration in PGlite with synthetic users and policies. They do not change a hosted database. Provider tests mock transport. Browser checks cover desktop/mobile rendering, guide search, Opal responses, and draft saving. Production identity, hosted policies, provider credentials/budgets, and migration replay in a connected test project require final rollout validation.

The local pnpm launcher attempted a forbidden project-link operation; equivalent npm scripts were used. Default Turbopack production build encountered Windows junction permissions; alternate webpack encountered file-creation permission errors. Lint/typecheck/tests and development preview are separate checks, not substitutes for a successful production build. Do not promote to production until the build is verified in CI or an environment supporting required file operations.

## Boundaries

The marketing application is untouched. Work is isolated on feat/opal-help-center and rebased onto current RunFloor main a2dc4c3. The original RunFloor working tree's pending signup/pricing changes were not copied, modified, or overwritten. The current remote signup and billing updates are preserved; the original local pending work is untouched.

Keep the portrait at public/opal/opal.png. Draft content must be reviewed, assigned appropriate roles, and supported by verification evidence before publication. The known Operations location inconsistencies and other audit gaps were not silently fixed as part of this change.
