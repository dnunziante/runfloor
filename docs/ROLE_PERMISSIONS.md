# Roles & Permissions

The page at `/admin/settings/roles` is linked from Settings. Admins and platform owners can configure all three tenant positions. Managers can configure Manager and Sales permissions, but cannot grant access outside their current permissions. Sales users can view the page without saving changes. Existing Admin-only and managerial role ceilings remain protected. This page configures access to the listed areas; existing action-level role and tenant boundaries still apply.

Checkboxes start at the existing role defaults. An asterisk continues to mark the role default after a checkbox is changed. Each position has independent Save and Discard controls. Saved permissions apply to that position throughout the selected organization. Role-management access remains reachable even when other administration access is disabled.

Server requests read current permissions rather than relying on browser state or user-editable token claims. The database separately validates role hierarchy, the Manager ceiling, workspace membership, checkbox schema, and optimistic revisions. Private audit records retain the actor and before/after selections. Restrictive area policies narrow existing access; they never create new underlying tenant/data grants. Platform-owner-only tools remain outside tenant permission configuration.

## Release status

The user approved the production permission controls and deployment on November 16, 2026. The role-permissions migration is applied, along with the follow-up actor index. Existing role defaults remain unchanged until a position is edited.

The migration has been exercised in an isolated PostgreSQL-compatible local database. Checks cover saved changes, hierarchy, Manager ceilings, Sales write denial, cross-workspace isolation, conflicting revisions, audit integrity, and direct database read restrictions. Default policies leave current access unchanged until a position is edited. Production verification confirmed RLS is enabled, no position overrides were created by deployment, and 50 existing tables have restrictive area policies. Security advisors reported no new role-permission security warnings. Existing unrelated platform advisories remain outside this release.

## Local preview

Run with `LOCAL_DEMO_MODE=true` outside production and open `/admin/settings/roles`. The local preview allows checkbox interaction without saving data. The development-only `previewRole=manager` or `previewRole=salesperson` query checks the editor's role-specific controls; it never changes the authenticated role or server save authorization and is ignored in production. Public demos remain read-only.
