# Procedure category management and archives

The approved scope adds category and procedure management to both Platform Admin templates and organization procedure libraries. These remain separate data stores with independent permissions and content. This supersedes the earlier presentation-only category restrictions.

## Behavior

- Category cards have menus for rename/description, move up/down, archive, and delete. Organization-owned default categories are customizable under the same manager permissions as custom categories.
- Procedure cards support the existing full reader/editor plus move, duplicate, archive, and confirmed permanent deletion. Copies retain all rich content, custom metadata, publishing state, and legacy steps.
- Archived categories and procedures have separate searchable lists, showing the original category, archive date, and archiving user. Unavailable historical user information is labeled honestly.
- Archiving a category archives only its active procedures. Restoring it restores those procedures together; independently archived procedures remain archived.
- Category deletion requires choosing whether to move procedures to an active category, move them to Uncategorized, archive them under Uncategorized, or permanently delete them. Already archived procedures remain archived when moved. Archived procedures retain the original category name when their category is deleted.
- Restoring a procedure uses its current saved category by default. If that category is archived, the user must restore the category or choose another active destination. When the original category was deleted, the saved fallback is Uncategorized.
- Category changes preserve visual icons/colors after renaming. Database constraints prevent active procedures from being created or restored inside archived categories.
- Permanently deleting a platform template preserves independent tenant copies; the existing foreign key clears their source-template reference.

## Data and authorization

Migration: `supabase/migrations/20260907005312_procedure_library_management.sql`.

This adds a platform category table, category descriptions/order/archive metadata, and procedure archive metadata. Existing content columns and tenant relationships are retained. Platform category names become a foreign key with cascading renames. Existing organization-owned category RLS policies are adjusted to allow managers to customize default copies.

Two SECURITY INVOKER functions implement the multi-row operations transactionally. Both require authentication and management authorization. Tenant operations also require and enforce the current organization ID. They do not use a service-role client or merge platform and tenant records. The existing tenant RLS still governs reads and writes.

Category operations lock category rows in a consistent order. A failed destination, permission check, or foreign-key constraint rolls back the operation. Permanent deletion requires an explicit confirmation value. Archived content is hidden from active lists and template distribution.

## Verification

- Final `pnpm lint`, `pnpm typecheck`, and `pnpm build` passed. Lint retains 10 pre-existing unused-disable warnings; build retains the existing metadataBase warnings.
- Read-only live preflight found 93 platform templates, 9 tenant procedures, and 33 tenant categories, with no conflicting case variants or invalid category-name lengths. It confirmed the migration is not activated.
- Isolated PostgreSQL tests passed for category create/rename/reorder/archive/restore, procedure duplication and content preservation, all category deletion dispositions, and procedure deletion.
- Separate tests passed for tenant isolation, representative write denial, tenant administrator denial from platform management, customizable defaults, invalid-destination rollback, and deletion confirmation.
- Browser checks on temporary development fixtures covered menus, delete choices, rename/move/restore dialogs, archive search, disabled order boundaries, and hidden management controls for representatives. Desktop and phone layouts were inspected; the phone layout had a 390px content viewport with no horizontal overflow.
- Actual Platform Admin data remained readable before activation, including the existing category counts. Compatibility paths keep the old library available while the migration is pending.
- Production activation succeeded on September 6 (September 7 UTC). All three tenants retain 90 standard procedures. Database advisors found no new database security issues; the unrelated leaked-password protection warning remains.

To repeat the isolated database tests:

```powershell
npm install --prefix .qa/runtime --no-package-lock --no-save @electric-sql/pglite@0.5.8
node scripts/test-procedure-library.mjs
```

The runner creates a fresh in-memory PostgreSQL database with explicit QA fixtures and loads the relevant existing migrations plus the new migration. It never connects to Supabase. The fixtures model the existing relevant columns, constraints, RLS, and authorization helpers; they do not contain company data.

## Activation status

Applied to the existing RunFloor Supabase project as migration `20260907005312` after the user requested all deployments. The activation adds metadata and category controls; it does not delete user procedures.

The application release includes both category management and the shared standard-procedure library. Isolated tests cover management mutations and tenant permissions; production checks confirm schema activation and retained tenant standards.
