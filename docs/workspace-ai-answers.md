# Workspace assistant answers

Operations and Executive assistants use the existing OpenAI connection with authorized RunFloor records and clearly labeled general AI guidance. Company facts must come from supplied records; general suggestions are not company policy, verified availability, or completed actions. Sales keeps its existing approved-knowledge policy.

Requests over 60,000 context characters are ranked by question and recent conversation terms and packed into bounded record excerpts. Large records are chunked so a relevant passage near the end remains eligible. Coverage notices and collection counts prevent a selected subset being treated as an exhaustive audit. Small workspaces retain complete records. Published procedures only, tenant isolation, role checks, and read-only behavior are preserved.

If source loading fails, the assistant can provide general guidance while explicitly stating that workspace facts are unavailable. It must not interpret unavailable data as empty or invent checklist completion, bookings, policies, scores, or financial results. Source cards appear only when the answer cites the supplied record source. The UI explains both answer types. No web search, record-writing actions, new provider, model change, schema migration, or secret changes are introduced.

Regression tests cover oversized workspaces, relevant passages late in long documents, follow-up selection, complete small records, missing sources, authorization before retrieval, and opt-in general guidance.
