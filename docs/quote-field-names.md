# Quote field names

Deal details has an **Edit fields** control for its eight existing amount fields. Names can be changed to match the wording used for a particular quote. **Done** applies the names; **Cancel** or Escape discards name edits. Every name is required and limited to 60 characters.

Names are presentation only: they do not change calculation categories, automatic location tax, fee defaults, permissions, or catalog records. The estimate, printed/PDF summary, copied text and customer email draft use the applied names. Sharing is disabled while the name editor is open, and changing a name requires the estimate to be reviewed again.

Names persist with the existing user/workspace-scoped browser quote when Save quote is used. They are specific to that saved quote, not workspace-wide defaults. Existing drafts without names retain the original names. New quote / Reset calculator restores the original names.

Verification: 157 non-billing regression tests passed; full lint had no errors (12 existing warnings). Browser tests covered validation, Done, Cancel, Escape/focus return, saved quote reload, review reset, email draft names, and an actual one-page PDF with matching names and total. Browser viewport checks at 390, 768, 1280 and 1440 pixels showed no page overflow after the intermediate-width layout correction. No customer messages were sent.

Destination and Delivery are entered manually per quote. Selecting a location does not replace either amount; it still supplies the existing automatic sales tax rate. Admin location settings no longer expose TP/RR destination or delivery defaults. Existing stored defaults and saved quote amounts are preserved; no database migration or record deletion is required.
