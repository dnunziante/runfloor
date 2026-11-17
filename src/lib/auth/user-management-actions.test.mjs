import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const organizationId = 'f17b4961-6312-4a6d-88a2-e89fa181eb01';
function fixture(role, allowAdd = false, membership = null) {
  const calls = [];
  const viewer = { id: 'admin-user', organizationId, role, demo: false };
  function from(table) {
    assert.ok(allowAdd, 'A rejected action must not reach the database');
    assert.notEqual(table, 'locations', 'Account Admin must not resolve a supplied location');
    const data = table === 'profiles' ? { id: 'existing-auth-user' } : table === 'organizations' ? { id: organizationId, name: 'QA account' } : membership;
    const query = { select() { return query; }, eq() { return query; }, ilike() { return query; }, maybeSingle: async () => ({ data, error: null }),
      insert(values) { calls.push({ table, values }); return Promise.resolve({ error: null }); } };
    return query;
  }
  const dependencies = {
    'next/headers': { headers: () => { throw Error('No invitation email should be prepared'); } },
    'next/cache': { revalidatePath() {} },
    '@/lib/auth/viewer': { getViewer: async () => viewer },
    '@/lib/supabase/server': { createClient: async () => ({ from }) },
    '@/lib/supabase/admin': { createAdminClient: () => ({ from }) },
  };
  const exports = {};
  const source = ts.transpileModule(readFileSync('src/app/admin/users/actions.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { exports, require: name => { assert.ok(name in dependencies, name); return dependencies[name]; } });
  return { actions: exports, calls };
}

test('account Admin, Manager and Sales cannot invoke platform-only user actions', async () => {
  for (const role of ['tenant_admin', 'manager', 'salesperson']) {
    const f = fixture(role);
    const form = new FormData();
    form.set('membershipId', '336f41fb-2883-4364-a938-c08d29519cdb');
    for (const action of ['changeUserLocation', 'updateUserCredentials', 'removeUserFromWorkspace', 'reactivateUserInWorkspace']) {
      const result = await f.actions[action]({}, form);
      assert.match(result.error, /Only the Platform Admin/);
    }
    assert.equal(f.calls.length, 0);
  }
});

test('account Admin adds an existing user without accepting forged workspace/location fields', async () => {
  const f = fixture('tenant_admin', true);
  const form = new FormData();
  Object.entries({ firstName: 'QA', lastName: 'User', phone: '5555550100', email: 'qa@example.com', role: 'salesperson',
    organizationId: 'e0e5b163-0b29-4689-82d2-76dbe25b21ff', locationId: '196cea7d-22dd-4aa5-815b-aef1bd8d3d6d' }).forEach(([key, value]) => form.set(key, value));
  const result = await f.actions.inviteUser({}, form);
  assert.equal(result.error, '');
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].values.organization_id, organizationId);
  assert.equal(f.calls[0].values.location_id, null);
  assert.equal(f.calls[0].values.role, 'salesperson');
});

test('adding a user cannot reactivate or relocate an existing pending or disabled membership', async () => {
  for (const status of ['invited', 'suspended']) {
    const f = fixture('tenant_admin', true, { id: 'membership', status, location_id: 'platform-assigned' });
    const form = new FormData();
    Object.entries({ firstName: 'QA', lastName: 'User', phone: '5555550100', email: 'qa@example.com', role: 'manager' }).forEach(([key, value]) => form.set(key, value));
    const result = await f.actions.inviteUser({}, form);
    assert.match(result.error, /Platform Admin/);
    assert.equal(f.calls.length, 0);
  }
});
