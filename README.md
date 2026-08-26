# RunFloor

RunFloor is the AI-powered sales platform for dealerships. Run your sales floor.

## Product catalog

The Product Library is organized into four tenant-managed families: ActivEV Pulse, Bintelli Beyond, Bintelli Nexus, and SIVO Edge. Tenant administrators can upload a cover image for each family and add any number of models or configurations beneath it from **Admin → Products**. Family images and product galleries use the private `product-images` Supabase Storage bucket; database rows and Storage policies remain tenant-scoped.


## Run locally

Requires Node.js and pnpm.

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Local demo mode

Set `LOCAL_DEMO_MODE=true` only in `.env.development.local` to bypass login while building locally. This uses a mock BGC administrator and sample product data. The local switch is ignored in production. A deliberately public sample deployment can instead set the server-only `PUBLIC_DEMO_MODE=true`; authenticated production deployments should leave it unset or false.

## Validate

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Included

- Marketing landing page and simulated login
- Responsive dashboard with mobile navigation
- Simulated sales assistant chat
- BGC product library and comparisons for Nexus, Beyond, and ActivEV Pulse
- Objection handling, email and text generators, and role-play training
- Training, knowledge base, analytics, and administration screens
- Loading, empty, and error-state examples

## Current foundation

Supabase authentication and tenant isolation are implemented for Sales, Coach, Growth, and Operations routes. Operations procedure and recurring-schedule management is limited to managers, tenant administrators, and the platform owner in both the interface and server actions. See `supabase/README.md` for project setup and administrator provisioning.

Products, Knowledge Base content, Sales Coach workflows, Growth plans, and Operations workflows support tenant-scoped persistence with a local demo fallback. OpenAI remains disconnected.

Tenant administrators can attach up to eight JPG, PNG, or WebP images (up to 5 MB each) when creating a product. Files upload directly to the tenant's private Supabase Storage folder, avoiding application-server upload limits. Galleries preserve image proportions, automatically center and scale each image to fit, use the first image as the primary thumbnail, and remove stored files when the product is deleted. Existing single images are retained as the first gallery image; products without an image continue to use the visual placeholder.

Each published product has a navigable Sales Guide built from approved tenant content. Tenant administrators manage best-fit customers, selling points, discovery questions, demonstration steps, objection responses, accessory opportunities, follow-up guidance, and disclaimers. Empty sections are labeled honestly; the application does not generate or infer missing product claims.

The Operations Process Improvement module includes employee-friendly problem and idea submission, department assignment, manager review, ownership, Five Whys analysis, corrective action, before-and-after measurements, results, lessons learned, and a basic improvement dashboard. Authenticated work is stored in tenant-scoped Supabase tables; local demo mode continues to use sample data. Lean waste classification remains reserved in the internal model for a later manager-analysis milestone.

The Executive Advisor command center combines Sales, Coach, Growth, Operations, Process Improvement, risk, and location signals. Local demo mode uses clearly labeled sample data. Authenticated managers and administrators receive RLS-protected rollups from approved tenant records, with unavailable measures shown honestly. Tenant administrators control explainable performance and risk targets separately from source records and platform methodology. It does not forecast or use OpenAI yet.

Executive reporting includes an explicit monthly sales-period selector and an administrator data-quality review. The review classifies every active location as approved, draft, missing, or outdated from existing tenant records. These statuses are deterministic and never infer missing financial results.

The Executive location comparison calculates sales pace, Coaching completion, Growth task completion, Operations completion, and open risks independently for each configured tenant location. New Coaching sessions and Growth action plans require a location selection when locations are available. Older unassigned records remain in organization totals but are intentionally excluded from location comparisons.

Managers and tenant administrators can acknowledge Executive priorities, assign an owner and due date, record a review note, and track progress through completion or dismissal. These period-specific review records are tenant-scoped and remain separate from the deterministic ranking calculation.

The Executive Accountability page summarizes active, completed, overdue, and unassigned priorities for a selected reporting period. Every saved review change is recorded in a tenant-protected, append-only history.

Tenant administrators can configure deterministic due-date reminders and overdue escalation timing. Managers see an explainable in-app notification queue; external email and text delivery are not connected.

The Leadership Decision Log links manager decisions to a reporting-period priority, owner, review date, expected outcome, and measured result without changing source records or priority scoring.

The Monthly Leadership Review assembles approved performance metrics, deterministic priorities, accountability exceptions, decisions, measured outcomes, wins, and risks into one period-specific meeting view. Managers can record review completion with optional meeting notes, and print a clean leadership copy. Completion records are tenant-scoped and period-specific. The review organizes existing tenant records without forecasting or inventing missing results.

Executive Historical Trends compares six or twelve months of approved sales targets, actual revenue, units, leads, appointments, and leadership-review completion. Managers can filter the entire view by location and select any two available periods for a deterministic comparison. Draft records and missing months are excluded rather than estimated.

Executive Data Readiness audits the selected month for configured locations, approved sales coverage, tenant targets, Coaching and Growth location assignments, Operations location coverage, reporting history, and leadership-review completion. The readiness score uses only the six required source checks and never estimates missing records.

The administrator Executive Setup Guide converts the six required readiness checks into an ordered workflow. It verifies completed steps from live records, highlights the first blocking step, and links administrators directly to the relevant configuration page.

The main administrator dashboard includes a compact Executive launch checklist. It shows live setup progress, the first blocking step, and direct links to the setup guide and detailed readiness audit immediately after sign-in.

## Version 1 foundation audit

The five-module foundation has been reviewed for navigation, role access, tenant isolation, data states, responsive behavior, and production configuration. Protected routes now fail closed when Supabase deployment variables are missing; local demo access requires the explicit development-only flag. The navigation begins with neutral, least-privileged user context and reveals tenant branding and administrator tools only after the authenticated context is loaded. Dependency versions are pinned for repeatable installs. Process Improvement metrics now derive verified work and represented locations from tenant records and handle empty workspaces without invalid percentages.

Before production use, enable Supabase Auth leaked-password protection and configure the Supabase URL and publishable key in the Vercel environment. No service-role key is required for the current application.

## Planned next milestone

The next milestone should connect one server-only OpenAI Sales Assistant endpoint to approved, tenant-scoped Knowledge Base content with citations, usage limits, logging, and a deterministic fallback. Do not connect the other four modules until that narrow workflow is verified.
