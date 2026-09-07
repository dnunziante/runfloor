# Procedure template library presentation

The new category management and archive implementation is documented in [procedure-library-management.md](procedure-library-management.md). It is prepared locally and awaits database activation.

The Platform Admin procedure library uses the existing server-loaded template and active-tenant data. Its presentation includes category cards, cross-category search (title, summary, category, owner), template previews, tenant assignment controls, and a collapsible creation form.

All standard categories, including Uncategorized, remain available. Additional category names present in stored templates are shown dynamically without renaming or migrating data. Counts use the supplied template records.

Add Template opens the existing creation/import forms and prefills the selected category. Open Procedure leads to a dedicated full-document read/editor route with return context. Assign to tenants retains the existing distribution controls. See `procedure-document-editor.md` for storage, security and verification details.
