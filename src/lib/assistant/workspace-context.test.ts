import test from 'node:test';
import assert from 'node:assert/strict';
import { selectWorkspaceContext } from './workspace-context.ts';

test('small workspaces preserve complete records and exact values', () => {
 const records={checklists:[{title:'Delivery',steps:[{title:'Inspect brakes',complete:false}]}],reportingPeriod:'2026-11',metrics:[{score:47.5}]};
 assert.deepEqual(JSON.parse(selectWorkspaceContext('checklist',records)),records);
});
test('oversized workspaces retain relevant records even late in large documents', () => {
 const records={procedures:[{title:'Manual',content:'Unrelated boilerplate. '.repeat(12000)+'Test drive appointment: confirm the requested time with the sales team.'}],checklists:[{title:'Delivery',steps:[{title:'Inspect brakes',complete:false}]}]};
 const result=selectWorkspaceContext('How do I schedule a test drive appointment?',records);
 assert.ok(result.length<=60000);
 assert.match(result,/confirm the requested time/);
 assert.match(result,/not an exhaustive/);
 assert.equal(JSON.parse(result).collectionCounts.procedures,1);
});
test('follow-up context helps select the earlier topic and never becomes instructions', () => {
 const result=selectWorkspaceContext('What about that?',{procedures:[{title:'Other',content:'other '.repeat(30000)},{title:'Handoff',content:'Escalate unresolved handoffs to the shift lead.'}]},'user: Tell me about handoffs');
 assert.ok(result.length<=60000);
 assert.match(result,/shift lead/);
 assert.match(result,/untrusted reference data/);
});
test('empty authorized workspace remains usable for general guidance', () => {
 assert.equal(selectWorkspaceContext('Help plan a test drive',{}),'{}');
});
