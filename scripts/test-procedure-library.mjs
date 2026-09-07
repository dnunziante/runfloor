import { PGlite } from '../.qa/runtime/node_modules/@electric-sql/pglite/dist/index.js';
import { readFileSync } from 'node:fs';
const db = new PGlite();
try {
  for (const file of ['supabase/tests/fixtures/procedure_library_schema.sql','supabase/migrations/20260830120000_operations_procedure_categories.sql','supabase/migrations/20260902193326_platform_procedure_templates.sql','supabase/migrations/20260907005312_procedure_library_management.sql']) await db.exec(readFileSync(file,'utf8'));
  await db.exec('begin;');
  const results=await db.exec(readFileSync('supabase/tests/procedure_library_management.sql','utf8'));
  console.log(JSON.stringify(results.filter(r=>r.rows?.length).map(r=>r.rows)));
  await db.exec('rollback;');
} catch(error) { console.error(error.message, error.where ?? "", error.internalQuery ?? ""); process.exitCode=1; } finally { await db.close(); }
