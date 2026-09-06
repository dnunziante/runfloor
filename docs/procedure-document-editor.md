# Procedure document viewer and editor

## Storage and compatibility

Platform templates remain in `platform_procedure_templates`. `summary` is the card preview and purpose; `steps` contains the complete legacy text as JSON strings; `category` is a text label; `owner` is the team/department; `version` is an integer. Platform templates are shared platform content, not organization-owned rows. No schema changes or data migrations were made.

Read mode adapts legacy steps without writing to the database. Every line, blank line, tab, bullet, and numbering character is retained, with identifiable headings styled for navigation. Rich body edits are stored in the existing `content.runfloorDocument` JSON field (`format: tiptap-v1`). Existing legacy steps and other content fields are preserved. Metadata-only edits do not rewrite the body.

Tiptap 3.31.3 supplies the editor, starter formatting, task lists and tables. Read and edit modes share extensions and document styling. The server validates the document schema and link protocols. Unsupported formatting is rejected rather than silently dropped. The editor sends plain JSON across the Server Action boundary.

## Flow and authorization

Template cards link to `/admin/platform/procedures/[id]`, initially in read mode. Back links preserve the category/search context. Edit exposes title, category, team, purpose and a full rich document. Saving increments the version, updates the timestamp and returns to read mode. An updated-at condition rejects concurrent stale saves. Cancel discards local changes. Closing/reloading the tab or following links warns about unsaved changes; browser history navigation within the application is not fully intercepted.

The page and both mutation actions require a signed-in, non-demo platform owner. They use the authenticated Supabase client and existing RLS. Duplicates copy content and metadata but receive new identity/audit timestamps. Tenant procedure IDs are never queried by the platform detail route.

Assignment retains the existing platform-owner authorization, active-tenant checks and duplicate-copy protection. It now carries the complete rich document, including an in-memory conversion of legacy steps. Tenant readers/editors use the same formatting components. Tenant saves retain their existing organization filters; rich documents save on the procedure row without replacing legacy short-title step records. No existing tenant rows were backfilled or altered.

## Verification

- Build, TypeScript, lint and focused document tests run locally.
- Browser content hashes match stored text for short, long, multi-section and extensively spaced originals across every populated category.
- A full long procedure was duplicated; its text matched the source exactly.
- A disposable copy was edited with headings, bold, italics, paragraphs/blank lines, line breaks, ordered and unordered lists, a checklist, a quote, a link and a table. Save persisted to Supabase; refresh produced identical text and rendered HTML. Cancel discarded an unsaved title edit.
- Rich duplicate content and legacy steps matched exactly in the database.
- A disposable tenant assignment retained the exact complete rich document. The tenant view and tenant rich save were verified. The two temporary templates and their one tenant procedure were removed afterward.
- All 21 original template records were compared against pre-test full-record hashes: unchanged.
- Anonymous detail requests redirect to sign-in without procedure content. A non-owner RLS update test affected zero rows. Tests reject tenant roles/demo users and unsafe document inputs.
- Desktop and 390px phone layouts checked; no document overflow. Mobile section navigation collapses by default.
- No commit, push or deployment performed.

Search remains lightweight over title, summary, category and owner. Full body search is intentionally not loaded into the category listing. Existing unrelated lint warnings and the metadataBase build warning remain.

## Changed files

- `src/app/admin/platform/procedures/[id]/page.tsx` and `procedures/actions.ts`: authorized document loading, save and duplicate.
- `src/components/procedure-document.tsx`, `procedure-document.module.css`, `procedure-formatting-toolbar.tsx`, `procedure-rich-body.tsx`: shared reader and rich editor.
- `src/lib/procedures/document.ts`, `extensions.ts`, `validation.ts`, `document.test.ts`: legacy compatibility, document format, validation and regression coverage.
- `src/components/platform-procedure-template-library.tsx` and its CSS module; `src/app/admin/platform/page.tsx`: category presentation and procedure navigation.
- `src/app/admin/platform/actions.ts`, `src/app/operations/actions.ts`, `src/components/operations-procedure-manager.tsx`: complete tenant copying, display and editing.
- `package.json`, `pnpm-lock.yaml`: editor dependencies and test registration.
- This document and `docs/procedure-template-library-ui.md`: implementation and verification notes.

Pre-existing authentication, global styling and generated Next environment changes were retained.
