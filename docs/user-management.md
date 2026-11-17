# Account user management

Account Admins can add users and assign Admin, Manager or Sales roles within their own account. Adding a user does not require a location. Location assignments remain visible as read-only information; unassigned users show Awaiting Platform Admin.

Only the Platform Admin can assign/change user locations, edit another user's credentials, remove access or reactivate disabled access. Account Admins cannot work around these limits by resubmitting the invitation form for an existing pending or disabled member. Product, content, Operations, and existing workspace permissions are unchanged.

The restriction is enforced in server actions and database triggers, including the supplementary member-location assignment table. Direct authenticated database writes cannot change locations, membership identities or status. Existing role and workspace boundaries remain. Trusted server provisioning and verified invitation acceptance remain authorized; acceptance preserves the latest assigned role/location and cannot revive suspended access.

Verified signup activation already provisions the account owner as an active account Admin. It happens at verified trial activation, before payment; subsequent payment does not replace that role. Payment processing and pricing are unchanged. Signup verification used a QA transaction which was rolled back; no real payment was attempted.

Release checks: 160 non-billing automated tests, full lint (zero errors, 12 existing warnings), production build/TypeScript, account Admin role save/reload, Platform Admin location save/reload, and browser widths 390/768/1280. Actual authenticated database checks rejected account Admin location/status/delete/supplementary assignment changes and Sales escalation, while permitting Admin role assignment and Platform Admin location assignment. QA invitation acceptance preserved later role/location changes and rejected suspended access. All SQL test mutations rolled back; browser QA role/location edits were restored. No messages or invitations were sent.
