// Fresh QA database only. Never use this bootstrap on an existing or production database.
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
const project = process.argv[2];
if (project !== "xcjokbopvhwtfzwvkysx")
  throw new Error(
    "This rehearsal script is restricted to runfloor-billing-qa.",
  );
const names = readdirSync("supabase/migrations")
  .filter((name) => name.endsWith(".sql") && name < "20261114190924")
  .sort();
const trainingMigration = "20260814190000_training_modules.sql";
names.splice(names.indexOf(trainingMigration), 1);
names.splice(
  names.indexOf("20260814170551_add_training_module_category.sql"),
  0,
  trainingMigration,
);
function historicalSql(name) {
  let sql = readFileSync("supabase/migrations/" + name, "utf8");
  if (name === "20260814190100_allow_module_lesson_reordering.sql")
    sql = sql.replace(
      "drop constraint training_module_lessons_module_id_sort_order_key",
      "drop constraint if exists training_module_lessons_module_id_sort_order_key",
    );
  if (name === "20260814190200_cover_training_module_foreign_keys.sql")
    sql = sql.replace(/create index /g, "create index if not exists ");
  if (name === "20260815101500_bgc_pilot_roles_and_invitations.sql")
    sql =
      readFileSync("supabase/qa/legacy-invitation-base.sql", "utf8") +
      "\n" +
      sql;
  if (name === "20260816120000_product_specifications.sql")
    sql =
      readFileSync("supabase/qa/legacy-knowledge-chunk-base.sql", "utf8") +
      "\n" +
      sql;
  if (name === "20260821113000_protect_hidden_coach_personas.sql")
    sql =
      'drop policy if exists "hidden personas have no direct client access" on public.coach_session_personas;\n' +
      sql;
  if (name === "20260822005822_ai_checklist_sections.sql")
    sql = sql.replace(
      "alter table public.operations_checklists add column creation_source",
      "alter table public.operations_checklist_sections add unique(id,organization_id);\nalter table public.operations_checklists add column creation_source",
    );
  return sql;
}
const sql = names
  .map(
    (name, index) =>
      `-- Source: ${name}\n${historicalSql(name)}${index === 0 ? "\ninsert into public.organizations(id,name,slug) values('10000000-0000-0000-0000-000000000001','RunFloor QA historical fixture','runfloor-qa-historical-fixture');" : ""}`,
  )
  .join("\n\n");
mkdirSync(".qa", { recursive: true });
writeFileSync(".qa/runfloor-historical-bootstrap.sql", sql);
console.log(
  `Prepared ${names.length} historical migrations for empty QA project ${project}. No database was modified.`,
);
