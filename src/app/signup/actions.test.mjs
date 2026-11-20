import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function fixture(user = null, freeEnabled = false, signupError = null) {
  const calls = [];
  const dependencies = {
    "@/lib/auth/redirects": { authOrigin: () => "https://example.invalid" },
    "next/navigation": { redirect: path => { throw new Error(`redirect:${path}`); } },
    "next/headers": { cookies: async () => ({ set: (...args) => calls.push(["cookie", ...args]) }) },
    "@/lib/supabase/config": { isSupabaseConfigured: () => true },
    "@/lib/supabase/server": { createClient: async () => ({
      auth: {
        getUser: async () => { calls.push(["user"]); return { data: { user } }; },
        signUp: async input => { calls.push(["signup", input]); return { data: { session: null }, error: signupError }; },
      },
      from: table => ({ update: values => ({ eq: async (column, id) => {
        calls.push(["profile", table, values, column, id]); return { error: null };
      } }) }),
    }) },
    "@/lib/supabase/admin": { createAdminClient: () => ({ rpc: async (name, parameters) => { calls.push(["activate", name, parameters]); return { error: null }; } }) },
  };
  const exports = {};
  const compiled = ts.transpileModule(readFileSync("src/app/signup/actions.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(compiled, { console: { error() {} }, exports, require: name => { assert.ok(name in dependencies, name); return dependencies[name]; }, process: { env: { RUNFLOOR_RV_BILLING_ENABLED: "true", RUNFLOOR_SALES_SOLO_ENABLED: freeEnabled ? "true" : "false", RUNFLOOR_SALES_SOLO_FREE_ENABLED: freeEnabled ? "true" : "false", APP_URL: "https://example.invalid" } } });
  return { actions: exports, calls };
}
function form(changes = {}) {
  const fields = { dealership: "Example RV", fullName: "Example Owner", email: "owner@example.invalid", password: "example-password-123", phone: "", ...changes };
  const result = new FormData();
  Object.entries(fields).forEach(([name, value]) => result.set(name, value));
  return result;
}
test("dealership, contact name, and email are required on the server before signup", async () => {
  for (const name of ["dealership", "fullName", "email"]) {
    const f = fixture();
    const result = await f.actions.signupTrial({ message: "" }, form({ [name]: "  " }));
    assert.match(result.message, /Enter your dealership/);
    assert.equal(f.calls.length, 0);
  }
});
test("phone is optional and never becomes a payment or authentication phone", async () => {
  const f = fixture();
  await f.actions.signupTrial({ message: "" }, form());
  const input = f.calls.find(call => call[0] === "signup")[1];
  assert.equal(input.options.data.contact_phone, null);
  assert.equal("phone" in input, false);
});
test("international contact phone is retained through email verification", async () => {
  const f = fixture();
  await f.actions.signupTrial({ message: "" }, form({ phone: " +1 (843) 555-0123 " }));
  assert.equal(f.calls.find(call => call[0] === "signup")[1].options.data.contact_phone, "+1 (843) 555-0123");
  assert.equal(JSON.parse(f.calls.find(call => call[0] === "cookie")[2]).phone, "+1 (843) 555-0123");
});
test("invalid phone is rejected before authentication or trial activation", async () => {
  const f = fixture();
  for (const action of ["signupTrial", "activateTrial"]) {
    const result = await f.actions[action]({ message: "" }, form({ phone: "not a number" }));
    assert.match(result.message, /valid phone number/);
  }
  assert.equal(f.calls.length, 0);
});
test("an unverified user cannot persist a profile phone or activate a trial", async () => {
  const f = fixture({ id: "owner-a", email_confirmed_at: null });
  const result = await f.actions.activateTrial({ message: "" }, form({ phone: "+1 843 555 0123" }));
  assert.match(result.message, /Verify your email/);
  assert.equal(f.calls.some(call => ["profile", "activate"].includes(call[0])), false);
});
test("successful activation saves the phone only to the verified user's existing profile", async () => {
  const f = fixture({ id: "owner-a", email_confirmed_at: "2026-11-14T12:00:00Z" });
  await assert.rejects(() => f.actions.activateTrial({ message: "" }, form({ phone: "+1 843 555 0123" })), /redirect:\/dashboard/);
  const update = f.calls.find(call => call[0] === "profile");
  assert.equal(update[1], "profiles");
  assert.equal(update[2].phone, "+1 843 555 0123");
  assert.equal(update[3], "id");
  assert.equal(update[4], "owner-a");
  assert.ok(f.calls.findIndex(call => call[0] === "activate") < f.calls.findIndex(call => call[0] === "profile"));
});

test("Free signup stays gated and activation uses verified owner identity without Stripe",async()=>{
 const blocked=fixture(null);await blocked.actions.signupTrial({message:''},form({plan:'sales_solo_free'}));assert.equal(blocked.calls.length,0);
 const f=fixture({id:'verified-owner',email_confirmed_at:'2026-11-17'},true);await assert.rejects(f.actions.activateTrial({message:''},form({plan:'sales_solo_free',actor:'forged-user'})),/redirect:\/products/);
 const call=f.calls.find(c=>c[0]==='activate');assert.equal(call[1],'activate_sales_solo_free');assert.equal(call[2].actor,'verified-owner');assert.equal(call[2].company,'Example RV');
});

test("selected plans survive verification on another device and unknown plans are rejected",async()=>{
 for(const plan of ['sales_solo_free','sales_solo']) {
  const f=fixture(null,true);await f.actions.signupTrial({message:''},form({plan}));
  const input=f.calls.find(c=>c[0]==='signup')[1];assert.ok(input.options.emailRedirectTo.endsWith(encodeURIComponent('/signup/activate?plan='+plan)));
 }
 const f=fixture();for(const name of ['signupTrial','activateTrial']) assert.match((await f.actions[name]({message:''},form({plan:'invented'}))).message,/valid RunFloor plan/);
 assert.equal(f.calls.length,0);
});

for (const [error, pattern] of [
  [{ code: 'over_email_send_rate_limit', status: 429 }, /Too many verification emails/],
  [{ code: 'email_address_not_authorized', status: 422 }, /delivery is not configured/],
  [{ code: 'unexpected_failure', status: 500 }, /service failed/],
  [{ code: 'weak_password', status: 422 }, /couldn't complete registration/],
]) test(`signup surfaces ${error.code} without claiming email delivery`, async () => {
  const f = fixture(null, false, error);
  const result = await f.actions.signupTrial({ message: '' }, form());
  assert.match(result.message, pattern);
  assert.equal(f.calls.some(c => c[0] === 'cookie'), false);
});
test('duplicate or concealed signup response never promises a new email or requires Stripe', async () => {
  const f = fixture();
  const result = await f.actions.signupTrial({ message: '' }, form());
  assert.match(result.message, /another signup may not send an email/);
  assert.match(result.message, /requires no payment method/);
  assert.equal(f.calls.some(c => c[0] === 'activate'), false);
});
