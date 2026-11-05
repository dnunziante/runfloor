# Temporary Sales Coaching restriction

November 5, 2026

## Flag and reactivation

The shared source of truth is `src/lib/features.ts`: `ENABLE_SALES_COACHING = false`. This is a compile-time feature restriction shared by server and client, independent of dealership template or tenant. To restore the complete module, change the flag to `true`, rebuild, and deploy. No database migration or data restoration is needed.

## Behavior while disabled

- The Sales Coaching group and all seven links are removed from the sidebar and workspace search for every role.
- Coaching, training, role-play and objection-handling entry points are hidden on Home, the sales/performance dashboard, the public landing page, relevant Executive dashboard cards, admin hubs, Knowledge Base and assistant tool links. Remaining cards reflow to fill the space.
- A shared FeatureLink applies the destination policy to static and dynamically supplied links without modifying the underlying records or reporting calculations.
- Direct requests for /coach, /training, /objections, /role-play and their nested pages, plus /admin/coach and /admin/training, redirect to /dashboard. Restrictions run before authentication/demo shortcuts. Server layouts provide a second render guard.
- Coaching API requests return 403; coaching/training server actions reject calls before accessing data. Knowledge Base upload/indexing remains available, with optional training generation disabled while the flag is off.

## Preserved

All 89 existing page files remain. Components, routes, scenarios, scores, session history, records and tables are intact. No migrations, deletes or external database writes were performed. Sales AI prompts, its request handler and retrieval/provider logic are unchanged; only its coaching tool link is hidden. Historical Executive calculations and data sources are unchanged.

## Verification

- 75 tests pass. New tests cover every role and tenant terminology, disabled and re-enabled navigation, real proxy behavior before authentication, all six server layouts, static/dynamic tool links, and Knowledge Base training controls across generic/RV/golf-cart templates.
- TypeScript and production build pass. Full lint passes with zero errors and the same 12 existing warnings. A follow-up check of the final changed UI also passes.
- Ten coaching/deep-link/admin URL checks return 307 to /dashboard.
- Four coaching API checks return 403.
- Eleven retained application pages return 200 with zero coaching links: Home, sales dashboard, products, calculator, messages, Knowledge Base, admin hubs, Sales AI, Operations and Executive.
- Browser checks confirm no Sales Coaching heading or links, no Training search result, and a direct Role Play session URL returning Home. Mobile menu works without horizontal overflow.

The release is published through the existing Runfloor GitHub/Vercel pipeline after these checks.
