# RunFloor workspace reorganization

Implemented in the existing application on November 3, 2026.

## Audit findings

- The previous sidebar had Business Assistant, Sales Assistant, Operations Assistant, Sales Coach, Business Growth Advisor and Executive Advisor sections.
- Sales and coaching already had working pages. The Sales dashboard remains /dashboard/performance; Home remains /dashboard. Operations remains /operations and Executive remains /executive.
- The original Business Assistant UI called the existing Sales retrieval endpoint. Its system prompt, communication standards, retrieval RPC, and interaction logging were reviewed before changes. Operations and Executive had no dedicated assistant screen or handler.
- Inventory labels already follow the industry template. The current auth context exposes tenant, role and industry, with no per-tenant module entitlement field; this change preserves the existing module availability and does not invent entitlement state.
- Existing repositories use authenticated Supabase clients, active organization filters and row-level policies. Executive already checks management roles; Growth previously admitted any signed-in member at the application layer. Growth now follows Executive management access, with server layouts, repository checks, and action authorization. Database policies and records are unchanged.
- Verified all 87 existing page files still exist. No existing route was removed or renamed.

## Every previous sidebar destination

| Previous label | Existing URL | New destination |
| --- | --- | --- |
| Home | /dashboard | Home |
| Dashboard | `/dashboard/performance` | Sales → Sales Tools |
| Quote & Loan Calculator | `/pricing-calculator` | Sales → Sales Tools |
| Products | `/products` | Sales → Sales Tools |
| Competitors | `/competitors` | Sales → Sales Tools |
| Comparisons | `/comparisons` | Sales → Sales Tools |
| Message Center | `/messages` | Sales → Sales Tools |
| Knowledge Base | `/knowledge-base` | Sales → Sales Tools |
| Analytics | `/analytics` | Sales → Sales Tools |
| Admin | `/admin` | Administration hub / Settings |
| Chat | `/assistant` | Sales → Sales AI |
| Suggested Prompts | `/assistant#suggested-prompts` | Sales → Sales AI |
| Assistant Tools | `/assistant#assistant-tools` | Sales → Sales AI |
| Operations Dashboard | `/operations` | Operations → Daily Operations |
| Today’s Checklists | `/operations/checklists` | Operations → Daily Operations |
| Procedures | `/operations/procedures` | Operations → Daily Operations |
| Operational Alerts | `/operations/alerts` | Operations → Daily Operations |
| Recurring Schedules | `/operations/schedules` | Operations → Daily Operations |
| Task Calendar | `/operations/calendar` | Operations → Daily Operations |
| Handoff Logs | `/operations/handoffs` | Operations → Daily Operations |
| Incident Reports | `/operations/incidents` | Operations → Daily Operations |
| Process Improvement | `/operations/improvements` | Operations → Daily Operations |
| Performance | `/operations/performance` | Operations → Daily Operations |
| Coach Dashboard | `/coach` | Sales → Sales Coaching |
| Training | `/training` | Sales → Sales Coaching |
| Objection Handling | `/objections` | Sales → Sales Coaching |
| Practice Scenarios | `/coach/scenarios` | Sales → Sales Coaching |
| Role Play | `/role-play` | Sales → Sales Coaching |
| Start Role Play | `/coach/session` | Sales → Sales Coaching |
| Session Review | `/coach/review` | Sales → Sales Coaching |
| My Development | `/coach/development` | Sales → Sales Coaching |
| Growth Opportunities | `/growth` | Executive → Executive Intelligence |
| Priority Scoring | `/growth/priorities` | Executive → Executive Intelligence |
| Action Plans | `/growth/plans` | Executive → Executive Intelligence |
| Performance | `/growth/performance` | Executive → Executive Intelligence |
| Scoring Settings | `/admin/growth` | Executive → Executive Configuration |
| Command Center | `/executive` | Executive → Executive Intelligence |
| Data Readiness | `/executive/readiness` | Executive → Executive Configuration |
| Historical Trends | `/executive/trends` | Executive → Business Management |
| Monthly Review | `/executive/review` | Executive → Business Management |
| Accountability | `/executive/accountability` | Executive → Business Management |
| Decision Log | `/executive/decisions` | Executive → Business Management |
| Setup Guide | `/admin/executive/setup` | Executive → Executive Configuration |
| Sales Results | `/admin/sales-results` | Executive → Business Management |
| Data Quality | `/admin/sales-results/quality` | Executive → Business Management |
| Executive Targets | `/admin/executive` | Executive → Business Management |
| Platform Admin | `/admin/platform` | Administration hub / Settings |
| Settings | `/admin/settings` | Administration hub / Settings |

Role Play now appears once, at /role-play. /coach/session remains available for starting sessions, including scenario query parameters. /quote-calculator, /email, /text, /generator, /knowledge and all other existing aliases remain unchanged. Platform Administration links to /admin, which retains access to every tenant administration tool. Platform owners reach /admin/platform through that hub; the existing owner-only authorization remains intact. Settings stays in the footer for administrators.

## Navigation and dashboards

- src/lib/navigation.ts is the centralized workspace/group/item configuration, role filter, tenant terminology mapping and most-specific active-route matcher. Search uses the same authorized destinations.
- Native details accordions share a name, so opening one closes the other. Sales opens on Home; navigation to a destination opens its workspace and highlights one most-specific link. Sidebar scrolling, collapse controls, mobile drawer, theme and keyboard summary controls are retained.
- Home now offers authorized workspace launch cards with dashboard and AI shortcuts. The existing Sales, Operations and Executive dashboards each have a dedicated AI entry. Existing metrics and scoring calculations are reused unchanged.
- Process Improvement and Operations Performance are preserved as additional Daily Operations links. Growth management pages remain at their existing URLs under Executive navigation.

## Assistant boundaries

| Assistant | Page | Handler | Server-authorized context |
| --- | --- | --- | --- |
| Sales AI | /assistant | /api/assistant | Approved owned/competitor products; ready documents whose IDs belong to an explicit sales collection allowlist; existing company style settings |
| Operations AI | /operations/assistant | /api/workspace-assistant/operations | Published procedures, checklists, alerts, schedules, handoffs and incidents returned by the tenant-scoped operations repository |
| Executive AI | /executive/assistant | /api/workspace-assistant/executive | Management-only performance signals, reporting-period priorities/reviews, action plans, historical trends and published tenant growth opportunities |

Each assistant has a separate identity, feature instructions, suggested prompts, relevant tool links and conversation key. The shared OpenAI request service and factual-grounding/presentation rules are retained. Operations never invokes Executive or Growth retrieval. Executive authorization runs before any source retrieval or AI call. Request bodies cannot choose an organization or a retrieval tool. Operations draft procedures are excluded before model invocation. Missing source data fails closed.

Sales document retrieval now filters results by document ID and explicit sales collections before the model call. General, Policies, Operations, Manuals and Guides, and unknown collections are deliberately not passed into Sales AI: they cannot be mapped safely to Sales versus confidential management content with the current metadata. Documents remain in the Knowledge Base. Administrators can reclassify approved sales material into Product knowledge, Sales process or Competitor Knowledge. Existing Sales interaction rows and analytics remain intact. Semantic communication-document examples are no longer retrieved into Sales AI because that legacy source has no workspace classification; tenant communication settings are retained.

Conversations are separated by assistant, tenant and user in sessionStorage for the current browser tab, capped at 60 turns. Six bounded prior turns are supplied as untrusted conversational context, never approved facts. New conversation clears only that assistant's tab history. No existing database histories, tables, records, prompts for other features, or tenant fields were migrated or deleted. New Operations/Executive transcripts are not persisted in the database and do not continue across browser sessions/devices.

## Verification

- 67 automated tests pass, including navigation destination existence, old deep links, tenant terminology, role filtering, separate conversation keys, collection exclusions, actual route authorization before retrieval, Operations/Executive context separation and active-tenant query scoping with isolated service doubles.
- TypeScript passes.
- Full lint passes with zero errors and 12 pre-existing warnings in untouched files. Follow-up lint of changed UI files also passes.
- Production build passes; the final rerun includes the Home launch cards and final UI fixes. Build warns about the pre-existing missing metadataBase setting.
- All three assistant pages, all three dashboards, /role-play and /coach/session return HTTP 200 in the separate sample-data preview.
- Browser checks confirm native workspace accordion behavior, one active item, automatic workspace expansion, separate Sales/Operations/Executive conversations, and mobile/tablet navigation without horizontal overflow on assistant pages.

## Remaining limits

The platform authentication project now reports ACTIVE_HEALTHY, and the configured authentication health endpoint returns HTTP 200. Live authenticated tenant and OpenAI response verification still requires an administrator login session; no account credentials were supplied during this implementation. The preview at localhost:3001 uses sample data and rejects AI requests honestly. The saved real-login settings and the main localhost:3000 preview were not switched back to demo mode. No production deployment or database migration has been performed.

Server security follows the existing [Supabase row-level security model](https://supabase.com/docs/guides/database/postgres/row-level-security); AI integration retains the current service after reviewing [official OpenAI text generation guidance](https://developers.openai.com/api/docs/guides/text).

## Files changed

- `README.md`
- `docs/workspace-reorganization.md`
- `package.json`
- `src/app/api/assistant/route.ts`
- `src/app/api/workspace-assistant/[workspace]/route.ts`
- `src/app/assistant/page.tsx`
- `src/app/dashboard/performance/page.tsx`
- `src/app/executive/assistant/page.tsx`
- `src/app/executive/layout.tsx`
- `src/app/executive/page.tsx`
- `src/app/globals.css`
- `src/app/growth/actions.ts`
- `src/app/growth/layout.tsx`
- `src/app/growth/page.tsx`
- `src/app/operations/assistant/page.tsx`
- `src/app/operations/page.tsx`
- `src/components/app-shell.tsx`
- `src/components/home-page.tsx`
- `src/components/navigation-icons.ts`
- `src/components/use-assistant-history.ts`
- `src/components/workspace-ai-entry.tsx`
- `src/components/workspace-assistant-page.tsx`
- `src/components/workspace-assistant.tsx`
- `src/components/workspace-launchpad.tsx`
- `src/components/workspace-search.tsx`
- `src/lib/assistant/workspace-route.test.mjs`
- `src/lib/assistant/workspaces.ts`
- `src/lib/growth/plans.ts`
- `src/lib/growth/scoring.ts`
- `src/lib/navigation.test.ts`
- `src/lib/navigation.ts`
- `src/lib/rag/openai.ts`

The generated next-env.d.ts change predated this task; temporary verification paths were removed. No environment files or production credentials are included in the change.
