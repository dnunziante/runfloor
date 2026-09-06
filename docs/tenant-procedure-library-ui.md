# Tenant Procedure Library redesign

The organization-facing `/operations/procedures` page now shares the Platform Admin category cards, color/icon configuration, value banner, and design styles. Data remains separate: tenant procedures/categories still come from `getOperationsWorkspace`, using the current organization filter and existing authenticated client/RLS. No server actions, repository queries, role checks, schemas, migrations, environment variables or master records were changed.

The default view uses the available width for category cards with a single header search. Category browsing provides descriptions, actual tenant counts, back navigation, empty states and creation in the selected category. Search works across tenant titles, categories, owners and summaries. The full reader and create/edit drawer use native modal dialogs with focus containment, Escape/close controls and focus restoration. All original fields, publishing status, procedure ordering, delete safeguards and custom category actions remain. Category creation/rename and deletion confirmation use in-app forms instead of browser prompts.

Existing constraints remain: default categories cannot be renamed/deleted; custom categories must be empty before deletion; categories use the original fixed-default/alphabetical ordering. There was no existing category drag/reordering API. Procedure ordering remains available within each category. Existing rich content uses the same Tiptap reader/editor. Legacy steps are loaded into edit with blank-line boundaries, and existing record metadata is retained during saves.

## Verification

- TypeScript and production build passed. Lint passed with the same 10 existing warnings. Existing automated suite: 48 passed.
- All 11 tenant categories opened; counts reflect the current organization, including empty categories.
- Disposable custom category: create, rename, nonempty-delete rejection, then successful empty deletion.
- Two disposable procedures: create, complete text read, edit, cancel, owner/status changes, move category, save/reload, reorder and delete.
- An existing rich procedure loaded all 5,566 characters in both reader and editor; editing was cancelled without writes.
- Database comparison of 70 original tenant procedure/category and master-template rows: unchanged. No extra test records remain. Cleanup of the three disposable records was explicitly approved by the user after automatic review required confirmation.
- Phone (390px), tablet (1024px) and desktop layout reviewed; single search, hidden idle editor, and no tested page/drawer horizontal overflow. Final browser error log clear.
- Tenant/role protection reviewed in unchanged server actions and repository; automated access tests pass. No cross-tenant data source was introduced.

Changed components: operations page and manager; shared procedure-library-visuals, procedure-overlay and procedure-workspace CSS; Platform Admin library now consumes the shared category/banner visuals. Changes are local for review, not committed or deployed.
