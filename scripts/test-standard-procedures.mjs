import { PGlite } from "../.qa/runtime/node_modules/@electric-sql/pglite/dist/index.js";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { procedureDocument } from "../src/lib/procedures/document.ts";

for (const withManagement of [false, true]) {
  const db = new PGlite();
  try {
    for (const file of ["supabase/tests/fixtures/procedure_library_schema.sql", "supabase/migrations/20260830120000_operations_procedure_categories.sql", "supabase/migrations/20260902193326_platform_procedure_templates.sql"]) await db.exec(readFileSync(file, "utf8"));
    if (withManagement) await db.exec(readFileSync("supabase/migrations/20260907005312_procedure_library_management.sql", "utf8"));
    const sourceSteps = ["PURPOSE\nPreserve every line.\n\n1. Preparation\nCheck the details.", "2. Completion\nRecord the outcome."];
    const rich = { custom: "preserve", runfloorDocument: { format: "tiptap-v1", document: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Formatted content", marks: [{ type: "bold" }] }] }] } } };
    await db.query("insert into public.platform_procedure_templates(id,title,category,owner,summary,steps,content,created_by) values('92000000-0000-0000-0000-000000000001','QA standard legacy','Sales Procedures','QA','QA legacy purpose',$1,'{}','90000000-0000-0000-0000-000000000001'),('92000000-0000-0000-0000-000000000002','QA standard rich','Service','QA','QA rich purpose','[]',$2,'90000000-0000-0000-0000-000000000001')", [JSON.stringify(sourceSteps), JSON.stringify(rich)]);
    await db.exec("insert into public.platform_procedure_templates(title,category,owner,summary,is_published,created_by) values('QA unpublished','Parts','QA','Do not distribute',false,'90000000-0000-0000-0000-000000000001'),('QA excluded category','Other','QA','Do not distribute',true,'90000000-0000-0000-0000-000000000001');");
    await db.exec("insert into public.operations_procedures(id,organization_id,title,category_id,category,owner,summary,status,content,platform_template_id,created_by) select '93000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001','Tenant customized title',id,name,'Tenant owner','Tenant custom purpose','draft','{\"custom\":\"tenant edit\"}','92000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001' from public.operations_procedure_categories where organization_id='91000000-0000-0000-0000-000000000001' and name='Sales Procedures';");
    const before = (await db.query("select to_jsonb(p) as record from public.operations_procedures p where id='93000000-0000-0000-0000-000000000001'")).rows[0].record;
    await db.exec(readFileSync("supabase/migrations/20260907003745_standard_procedures_all_templates.sql", "utf8"));
    assert.deepEqual((await db.query("select to_jsonb(p) as record from public.operations_procedures p where id='93000000-0000-0000-0000-000000000001'")).rows[0].record, before);
    assert.equal((await db.query("select count(*)::integer n from public.operations_procedures")).rows[0].n, 4);
    const installed = (await db.query("select content from public.operations_procedures where organization_id='91000000-0000-0000-0000-000000000002' and platform_template_id='92000000-0000-0000-0000-000000000001'")).rows[0].content;
    assert.deepEqual(installed.runfloorDocument.document, procedureDocument({ steps: sourceSteps, content: {} }));
    assert.deepEqual((await db.query("select content from public.operations_procedures where organization_id='91000000-0000-0000-0000-000000000002' and platform_template_id='92000000-0000-0000-0000-000000000002'")).rows[0].content, rich);
    await db.exec("begin; select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000001',true); set local role authenticated;");
    assert.equal((await db.query("select public.install_standard_procedures('91000000-0000-0000-0000-000000000001') n")).rows[0].n, 0);
    await db.exec("insert into public.organizations(id) values('91000000-0000-0000-0000-000000000003');");
    assert.equal((await db.query("select count(*)::integer n from public.operations_procedures where organization_id='91000000-0000-0000-0000-000000000003'")).rows[0].n, 2);
    await db.exec("reset role; select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000002',true); set local role authenticated;");
    await assert.rejects(db.query("select public.install_standard_procedures('91000000-0000-0000-0000-000000000002')"), /Platform owner access/);
    await db.exec("rollback;");
    console.log(`PASS: backfill, future tenant seed, idempotency, content parity, tenant preservation, and authorization (${withManagement ? "with" : "without"} archive migration).`);
  } catch (error) { console.error(error.message, error.where ?? "", error.internalQuery ?? ""); process.exitCode = 1; }
  finally { await db.close(); }
}
