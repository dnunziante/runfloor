# Billable AI inventory

All existing OpenAI calls route through `src/lib/ai-billing/provider.ts`. Adding a provider or billable operation requires a rate, bounded reservation, actual-usage settlement and accounting tests. Unknown paths/models fail closed.

| Operation | Entry point / feature |
| --- | --- |
| createEmbeddings | Knowledge indexing, retrieval/query embeddings, training/document processing |
| createGroundedAnswer | Sales Assistant |
| createWorkspaceAnswer | Operations and Executive assistants |
| createGeneratedChecklist | Operational document-to-checklist generation |
| createRevisedProcedure | Procedure revision |
| createImportedProcedure | Procedure text/image import |
| createGroundedTrainingLesson | Generated training and quiz lessons |
| createSalesEmail | Sales email generation and quality retry |
| createSalesText | Sales text generation |
| extractCustomerTextTemplates | Email/text template extraction |
| product_extraction | Product document model extraction |
| sales_coaching | Adaptive Sales Coach messages and evaluation |

The ten shared helpers are in `src/lib/rag/openai.ts`; the two former direct transports were in product extraction and the adaptive coaching API. Both now use centralized metering. Every repeated helper invocation, including a quality retry or a later indexing batch, reserves and settles its own provider cost. Local file parsing, deterministic scoring, non-AI search and ordinary database work do not consume AI credits.

No cron worker with an independent billing identity currently invokes these helpers. Future background jobs must pass a tenant/user context through `withAiBillingContext`, independently authorize that job, and use the same reservation functions. A missing signed-in context fails closed.
