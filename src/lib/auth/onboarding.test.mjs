import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function moduleAt(path, dependencies = {}, extras = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, URL, URLSearchParams, Set, Date, process: { env: { APP_URL: 'https://commandly-rho.vercel.app', NODE_ENV: 'production' } }, require: name => { assert.ok(name in dependencies, name); return dependencies[name]; }, ...extras });
  return exports;
}
const redirects = moduleAt('src/lib/auth/redirects.ts');
const { completeEmailLink } = moduleAt('src/lib/auth/complete-email-link.ts', { './redirects': redirects });
const user = { id: 'new-employee', email: 'employee@example.invalid', email_confirmed_at: '2026-11-19' };
const hash = '#access_token=access&refresh_token=refresh&type=invite';
function authFixture({ exchangeError = null, actualUser = user } = {}) {
  const calls = [];
  const auth = {
    setSession: async values => { calls.push(['setSession', values]); return { error: exchangeError }; },
    getUser: async () => { calls.push(['getUser']); return { data: { user: actualUser }, error: null }; },
  };
  return { auth, calls };
}
test('fragment invitation establishes and validates session before password setup', async () => {
  const f = authFixture();
  assert.equal(await completeEmailLink(f.auth, hash, '/dashboard'), '/auth/accept');
  assert.deepEqual(f.calls.map(c => c[0]), ['setSession', 'getUser']);
});
test('fragment recovery and signup keep the intended onboarding destination', async () => {
  assert.equal(await completeEmailLink(authFixture().auth, hash.replace('invite', 'recovery'), '/dashboard'), '/auth/reset-password');
  assert.equal(await completeEmailLink(authFixture().auth, hash.replace('invite', 'signup'), '/signup/activate?plan=complete'), '/signup/activate?plan=complete');
});
test('expired, reused, missing and invalid fragment tokens never reach onboarding', async () => {
  for (const fragment of ['', '#error=access_denied&error_code=otp_expired', '#access_token=access']) {
    const f = authFixture(); assert.equal(await completeEmailLink(f.auth, fragment, '/dashboard'), '/auth/link-error'); assert.equal(f.calls.length, 0);
  }
  assert.equal(await completeEmailLink(authFixture({ exchangeError: { code: 'refresh_token_not_found' } }).auth, hash, null), '/auth/link-error');
  for (const actualUser of [null, { id: 'unverified' }]) assert.equal(await completeEmailLink(authFixture({ actualUser }).auth, hash, null), '/auth/link-error');
});
test('auth destinations reject external redirects and header controls', () => {
  for (const path of ['//evil.invalid', '/\\evil.invalid', '/\nevil.invalid', 'https://evil.invalid', '/ foo']) assert.equal(redirects.safeAuthNext(path), '/dashboard');
  assert.equal(redirects.authOrigin(), 'https://commandly-rho.vercel.app');
  assert.throws(() => moduleAt('src/lib/auth/redirects.ts', {}, { process: { env: { APP_URL: 'https://evil.invalid/path', NODE_ENV: 'production' } } }).authOrigin());
});
function callbackFixture(error = null, actualUser = user) {
  const calls = []; let cookieHandler;
  const auth = {
    exchangeCodeForSession: async code => { calls.push(['code', code]); cookieHandler.setAll([{ name: 'sb-session', value: 'session', options: { httpOnly: true } }]); return { error }; },
    verifyOtp: async input => { calls.push(['otp', input]); cookieHandler.setAll([{ name: 'sb-session', value: 'session', options: { httpOnly: true } }]); return { error }; },
    getUser: async () => ({ data: { user: actualUser }, error: null }),
  };
  const GET = moduleAt('src/app/auth/callback/route.ts', {
    'next/server': { NextResponse: { redirect: destination => ({ destination: String(destination), headers: new Map(), cookies: { set: (...args) => calls.push(['cookie', ...args]), delete: name => calls.push(['delete', name]) } }) } },
    '@supabase/ssr': { createServerClient: (_url, _key, options) => { cookieHandler = options.cookies; return { auth }; } },
    '@/lib/supabase/config': { getSupabaseConfig: () => ({ url: 'https://example.invalid', publishableKey: 'public' }) },
    '@/lib/auth/redirects': redirects,
  }).GET;
  return { calls, get: search => GET({ url: 'https://commandly-rho.vercel.app/auth/callback' + search, cookies: { getAll: () => [] } }) };
}
test('PKCE callback persists session cookies and directs trial activation', async () => {
  const f = callbackFixture(); const response = await f.get('?code=new&next=/signup/activate');
  assert.equal(response.destination, 'https://commandly-rho.vercel.app/signup/activate');
  assert.ok(f.calls.some(c => c[0] === 'cookie' && c[1] === 'sb-session'));
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});
test('token-hash invitation works without a signup-browser PKCE verifier', async () => {
  const f = callbackFixture(); const response = await f.get('?token_hash=hashed&type=invite&next=/dashboard');
  assert.equal(response.destination, 'https://commandly-rho.vercel.app/auth/accept');
  assert.equal(f.calls[0][0], 'otp');
});
test('callback hands fragment-only links to the browser and rejects expired codes and invalid OTP types', async () => {
  assert.match((await callbackFixture().get('?next=/auth/accept')).destination, /\/auth\/complete\?next=/);
  for (const query of ['?error=expired', '?token_hash=hash&type=sms']) {
    const f = callbackFixture(); assert.match((await f.get(query)).destination, /\/auth\/link-error$/); assert.equal(f.calls.length, 0);
  }
  assert.match((await callbackFixture({ code: 'otp_expired' }).get('?code=expired')).destination, /\/auth\/link-error$/);
  assert.match((await callbackFixture(null, null).get('?code=valid')).destination, /\/auth\/link-error$/);
});
function passwordFixture(invitation, rpcError = null) {
  const calls = [];
  const actions = moduleAt('src/app/auth/accept/actions.ts', {
    'next/navigation': { redirect: path => { throw Error('redirect:' + path); } },
    '@/lib/auth/pending-invitation': { getPendingInvitation: async actual => { assert.equal(actual.id, user.id); calls.push('pending'); return invitation; } },
    '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }), updateUser: async () => { calls.push('password'); return { error: null }; } }, rpc: async name => { assert.equal(name, 'accept_organization_invitation'); calls.push('accept'); return { error: rpcError }; } }) },
  });
  const form = new FormData(); form.set('password', 'secure-test-password'); form.set('confirmation', 'secure-test-password');
  return { calls, run: () => actions.setInvitationPassword({}, form) };
}
test('expired or already accepted workspace invitation cannot change a password or membership', async () => {
  const f = passwordFixture(null); assert.match((await f.run()).error, /expired|already accepted/); assert.deepEqual(f.calls, ['pending']);
});
test('valid employee setup saves password then invokes authoritative membership acceptance', async () => {
  const f = passwordFixture({ id: 'pending' }); await assert.rejects(f.run(), /redirect:\/dashboard\?invited=1/); assert.deepEqual(f.calls, ['pending', 'password', 'accept']);
});
test('membership rejection does not claim successful onboarding', async () => {
  const f = passwordFixture({ id: 'pending' }, { message: 'suspended' }); assert.match((await f.run()).error, /no longer available/);
});

test('real invitation SQL enforces identity, expiry, replay, disabled access and current dealership assignments', async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  try {
    await db.exec(`create schema auth; create schema private; create role authenticated;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('email',current_setting('request.jwt.claim.email',true)) $$;
      create type public.organization_role as enum('tenant_admin','manager','salesperson');
      create table profiles(id uuid primary key,full_name text,first_name text,last_name text,phone text,email text);
      create table organization_invitations(id uuid primary key default gen_random_uuid(),organization_id uuid,email text,first_name text,last_name text,phone text,role organization_role,location_id uuid,auth_user_id uuid,status text,expires_at timestamptz,created_at timestamptz default now(),accepted_by uuid,accepted_at timestamptz);
      create table organization_memberships(organization_id uuid,user_id uuid,role organization_role,status text,location_id uuid,unique(organization_id,user_id));`);
    await db.exec(readFileSync('supabase/migrations/20261117151000_preserve_pending_user_assignment.sql', 'utf8'));
    const employee = '10000000-0000-0000-0000-000000000001', org = '20000000-0000-0000-0000-000000000001', location = '30000000-0000-0000-0000-000000000001';
    await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.email','employee@example.invalid',false)", [employee]);
    await db.query("insert into organization_invitations(organization_id,email,first_name,last_name,role,location_id,auth_user_id,status,expires_at) values($1,'employee@example.invalid','New','Employee','salesperson',null,$2,'pending',now()+interval '1 day')", [org, employee]);
    await db.query("insert into organization_memberships values($1,$2,'manager','invited',$3)", [org, employee, location]);
    await db.query("select set_config('request.jwt.claim.email','wrong@example.invalid',false)");
    await assert.rejects(db.query('select * from private.accept_organization_invitation()'), /No active invitation/);
    await db.query("select set_config('request.jwt.claim.email','employee@example.invalid',false)");
    await db.exec("update organization_invitations set expires_at=now()-interval '1 second'");
    await assert.rejects(db.query('select * from private.accept_organization_invitation()'), /No active invitation/);
    await db.exec("update organization_invitations set expires_at=now()+interval '1 day'; update organization_memberships set status='suspended'");
    await assert.rejects(db.query('select * from private.accept_organization_invitation()'), /disabled/);
    await db.exec("update organization_memberships set status='invited'");
    const accepted = (await db.query('select * from private.accept_organization_invitation()')).rows[0];
    assert.equal(accepted.accepted_organization_id, org); assert.equal(accepted.accepted_role, 'manager'); assert.equal(accepted.accepted_location_id, location);
    assert.equal((await db.query('select status from organization_memberships')).rows[0].status, 'active');
    await assert.rejects(db.query('select * from private.accept_organization_invitation()'), /No active invitation/);
    assert.equal((await db.query('select count(*)::int as count from organization_memberships')).rows[0].count, 1);
  } finally { await db.close(); }
});

test('pending lookup binds the verified user, email, expiry and workspace without granting access', async () => {
  const calls = [];
  let table;
  const query = new Proxy({}, { get: (_target, method) => method === 'then' ? undefined : (...args) => {
    calls.push([table, method, ...args]);
    if (method === 'maybeSingle') return Promise.resolve({ data: table === 'organization_invitations' ? { id: 'invite', organization_id: 'dealership' } : { status: 'invited' }, error: null });
    return query;
  } });
  const { getPendingInvitation } = moduleAt('src/lib/auth/pending-invitation.ts', {
    'server-only': {}, '@/lib/supabase/admin': { createAdminClient: () => ({ from: name => { table = name; return query; } }) },
  });
  assert.equal(await getPendingInvitation({ id: user.id }), null); assert.equal(calls.length, 0);
  assert.equal((await getPendingInvitation(user)).organization_id, 'dealership');
  assert.ok(calls.some(c => c[1] === 'eq' && c[2] === 'auth_user_id' && c[3] === user.id));
  assert.ok(calls.some(c => c[1] === 'eq' && c[2] === 'email' && c[3] === user.email));
  assert.ok(calls.some(c => c[1] === 'gt' && c[2] === 'expires_at'));
  assert.ok(calls.some(c => c[0] === 'organization_memberships' && c[1] === 'eq' && c[2] === 'organization_id' && c[3] === 'dealership'));
});
