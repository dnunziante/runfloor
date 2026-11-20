import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
try {
 await db.exec('create schema private');
 const original=readFileSync('supabase/migrations/20260907003745_standard_procedures_all_templates.sql','utf8');
 const helper='create function private.standard_procedure_content'+original.split('create function private.standard_procedure_content')[1].split('end; $$;')[0]+'end; $$;';
 await db.exec(helper.replace('private.standard_procedure_content','private.legacy_procedure_content'));
 await db.exec(readFileSync('supabase/migrations/20261120032954_optimize_onboarding_procedure_conversion.sql','utf8'));
 const rich={custom:'keep',runfloorDocument:{format:'tiptap-v1',document:{type:'doc',content:[{type:'paragraph'}]}}};
 const samples=[null,'',[],{},['PURPOSE\nFirst paragraph.\n\n1. Preparation\nCheck details.','2. Completion\r\nRecord outcome.'],['# Heading',12,{step:'structured'}], 'Title\rParagraph\n\nEnd'];
 for (const steps of samples) for(const content of [null,{},rich]) {
  const args=[JSON.stringify(steps),JSON.stringify(content)];
  const {rows}=await db.query('select private.legacy_procedure_content($1::jsonb,$2::jsonb) old,private.standard_procedure_content($1::jsonb,$2::jsonb) optimized',args);
  assert.deepEqual(rows[0].optimized,rows[0].old);
 }
 const steps=Array.from({length:160},(_,i)=>`${i+1}. Preparation\nConfirm the details with the customer and record the agreed next action.\n\nFollow up with the responsible employee before completion.`);
 const start=performance.now();
 const result=await db.query('select sum(jsonb_array_length(private.standard_procedure_content($1::jsonb || jsonb_build_array(\'Workspace \' || i),\'{}\')->\'runfloorDocument\'->\'document\'->\'content\')) as nodes from generate_series(1,90) as docs(i)',[JSON.stringify(steps)]);
 console.log(`PASS: 21 content parity cases; 90 starter documents converted in ${Math.round(performance.now()-start)} ms; ${result.rows[0].nodes} nodes preserved.`);
} finally {await db.close();}
