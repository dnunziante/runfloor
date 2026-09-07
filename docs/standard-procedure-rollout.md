# Standard procedures for every industry template

The September 6 request designates every procedure in these nine Platform Admin categories as standard across all industry templates: Sales Procedures, Delivery & Post-Sale, Inventory, Service, Parts, CRM & Lead Management, Customer Experience, Management, and Employee & Administrative.

The baseline currently contains **90 published procedures**. Each industry template inherits this shared baseline. New tenants automatically receive independent, published copies when their organization is created, regardless of industry. New platform procedures created in these categories are also marked standard for future tenants. Existing tenant copies are not automatically overwritten when the source changes.

## Completed rollout

The independent migration `20260907003745_standard_procedures_all_templates.sql` is applied to the existing RunFloor Supabase project. It adds the standard designation, source-identity uniqueness, content-preserving installer, and automatic organization seeding, then installs missing copies for every existing tenant. It does not depend on or activate the earlier category-management/archive migration.

| Tenant | Added | Standard procedures after rollout | Total procedures |
| --- | ---: | ---: | ---: |
| BGC Dealerships | 90 | 90 | 91 |
| Rayne RV | 84 | 90 | 92 |
| Golf Cart Demo | 90 | 90 | 90 |
| Total | 264 | 270 | 273 |

Golf Cart Demo remains suspended. All tenant statuses are unchanged. Six linked Rayne RV procedures were skipped, and all nine pre-existing tenant procedure rows have identical before/after hashes. Existing tenant-created or same-named procedures remain intact.

## Implementation

- `platform_procedure_templates.is_standard` identifies the shared baseline without duplicating the source per industry.
- The unique partial index on `(organization_id, platform_template_id)` prevents repeated pushes from duplicating the same source. Tenant-created duplicates with no source link remain valid.
- A SECURITY INVOKER organization trigger runs after category seeding and copies standard procedures within the same organization-creation transaction.
- The explicit install function requires an authenticated platform owner. All statements retain RLS; no new service-role or SECURITY DEFINER function was added.
- Rich documents pass through unchanged. Legacy text is converted with the same heading and line-preservation rules as the existing editor. Other content metadata is retained.
- New copies are published; source version is recorded. Existing tenant publishing states and edits remain unchanged.
- Archived/unpublished sources are excluded. A matching archived tenant category causes the operation to fail without partial writes rather than silently restoring or miscategorizing content.
- Each industry-template editor now displays the inherited standard library with category counts and links to the source procedures. This UI change is local until code deployment.

## Verification

Isolated PostgreSQL tests passed with and without the pending archive migration: existing-tenant backfill, automatic future-tenant seeding, repeated-install idempotency, rich and legacy content parity, preservation of tenant edits, and owner-only install authorization.

Read-only production verification confirmed all 264 new copies match their source title, summary, owner, rendered document, and source version. Each tenant has 90 distinct source-linked standards; all nine original records are unchanged.

Final `pnpm lint`, `pnpm typecheck`, and `pnpm build` passed. Lint retains ten pre-existing warnings. The template editor was manually checked on desktop and a 390px phone viewport: all nine categories and 90 procedures are present, category details expand, and the phone layout has no horizontal overflow.

Supabase security advisors returned no database findings for the change. The project still has the unrelated leaked-password-protection warning.

Repeat local database tests with `node scripts/test-standard-procedures.mjs` after installing the isolated PGlite runtime as described in `procedure-library-management.md`.
