# Version 1 roadmap

Each milestone should be completed and verified before the next begins.

## Milestone 1 — Application shell (complete)

- Responsive dashboard layout
- Desktop sidebar, top navigation, and mobile menu
- Reusable interface primitives
- Placeholder destinations for all Version 1 areas

## Milestone 2 — Authentication and tenant foundation (complete)

- Supabase project and environment setup
- Company, membership, and role model
- Protected routes and tenant-aware access controls
- Administrator and representative roles

## Milestone 3 — Product and knowledge management (complete)

- Product catalog CRUD
- Knowledge document metadata and upload flow
- Publishing and draft states
- Tenant-scoped database policies

## Milestone 4 — Persistent Sales Coach foundation (complete)

- Tenant-scoped practice scenarios and administrator publishing
- Three-round conversations with configurable deterministic C.L.O.S.E.R. scoring
- Saved sessions, round responses, scores, and review history
- Row-level security for representatives, managers, and tenant administrators
- Demo fallbacks while local authentication bypass is active

## Milestone 5 — Grounded AI assistant (next)

- OpenAI server-side integration
- Retrieval from approved tenant knowledge
- Source references and uncertainty behavior
- Usage limits, logging, and safety evaluation

## Milestone 6 — Guided sales tools

- Objection workflow
- Email and text generator
- Saved templates and feedback
- Methodology-aware prompts

## Milestone 7 — Pilot readiness

- Invitations and onboarding
- Accessibility, security, and responsive QA
- Error monitoring and basic product analytics
- Pilot documentation and feedback loop

## Release boundary

Version 1 is ready for a controlled pilot when a company can securely onboard, maintain approved knowledge, invite representatives, and use grounded sales tools without data crossing tenant boundaries.

## Operations Assistant prototype

- Approved and applied September 6, 2026: the 90 procedures in the nine selected standard categories are inherited by every industry template, automatically seeded for new tenants, and distributed to all existing tenants without overwriting existing tenant records. See `standard-procedure-rollout.md`.

- Approved September 6, 2026: persistent category management and recoverable archives for both platform procedure templates and tenant procedures, with independent data and permissions. Implementation is prepared locally; shared database activation awaits explicit approval following automatic review. See `procedure-library-management.md`.

- Added a responsive sample-data dashboard for daily checklist completion, assignments, quick procedures, and operational alerts.
- All operational information is explicitly labeled as prototype data; no live inventory, employee, scheduling, database, or AI integration is connected.
- Added browser-local checklist creation, location and owner assignment, due dates, step completion, and retained progress with loading, error, and empty states.
- Added a searchable, category-filtered Operations Procedure Library with detailed ordered steps, ownership, versioning, publishing status, and browser-local administrator editing.
- Added browser-local Operational Alert Management with severity, location, ownership, due dates, acknowledgment, resolution, reopening, filters, and retained status history.
- Added a browser-local Operations Performance dashboard with checklist completion, overdue work, alert follow-through, resolution time, location comparisons, and transparent metric definitions.
- Added browser-local recurring schedules that turn saved procedures into daily, weekly, or monthly checklist assignments with pause, resume, and deterministic next-run controls.
- Added a browser-local monthly Operations Task Calendar combining checklist deadlines, alert due dates, and recurring schedule runs with location and work-type filters.
- Added browser-local Operations Handoff Logs for shift context, unresolved issues, decisions, next-action ownership, acknowledgment, closure, and location/status filtering.
- Added browser-local Operations Incident Reports for severity, containment, investigation, root cause, corrective action, ownership, deadlines, and verified closure.
- Added the deployed tenant-scoped Supabase Operations foundation and connected authenticated persistence for procedures, schedules, checklists, alerts, handoffs, incidents, calendar, dashboard, and performance views. Local demo mode retains the browser-storage fallback.
## Business Growth Advisor prototype

- Added a mock-data opportunity dashboard with category and search filters.
- Added opportunity detail pages with impact, effort, validation steps, and measures.
- All insights are explicitly labeled simulated; no live market data, database, or AI is connected.
- Added browser-local action plans with owners, target dates, measures, task progress, and plan status.
- Added Supabase persistence and organization-level row security for Growth Action Plans; local demo mode continues to use browser storage.
- Added transparent deterministic scoring across impact, effort, confidence, cost, risk, and strategic alignment, with weighted ranking and comparison.
- Added a tenant administrator scoring editor with Supabase persistence and local-demo fallback.
- Added tenant opportunity management for creating, editing, publishing, and archiving Growth Advisor opportunities.
- Added a tenant-aware Growth Performance dashboard for plan status, deadlines, task completion, opportunity-level execution health, and verified business results.
- Added verified Growth Plan outcomes for dated leads, appointments, revenue, costs, notes, and deterministic ROI reporting, with tenant-scoped Supabase policies and a browser-local demo fallback.

## Competitor model library

- Added a dedicated Competitors page in Sales navigation using the shared product cards, galleries, search, brand filter, and detail guides.
- Uses only published competitor products from the existing tenant catalog. Missing competitor prices are labeled as not provided. Administrators continue managing models through Products and pricing.

- Added a separate Admin > Competitor products & pricing page with model images, manual creation, document extraction, competitor-only spreadsheet validation, and grouped management controls. Shared product editors return to competitor management, and catalog actions refresh both competitor pages.

- Competitor brand families reuse tenant product_families with a reserved competitor-brand- slug prefix, filtered out of the own-product family library. Family covers use the existing image storage. Manual and document uploads inside a family preserve its ID; ungrouped imports match by brand name.

- Redesigned competitor management with live count cards, section navigation that preserves form entries, a separate image panel within model creation, collapsible specifications, brand covers and quick actions, searchable/filterable management tables, archive browsing, and CSV export of current results. Existing create, upload, edit, duplicate, guide, publish, archive, and remove actions remain available.
