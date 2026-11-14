import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import ts from "typescript";
import Stripe from "stripe";
const sdk = new Stripe("sk_test_placeholder"),
  secret = "whsec_test_placeholder";
function route({
  paid = true,
  live = false,
  badAccount = false,
  refunded = 0,
} = {}) {
  const calls = [];
  const query = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    maybeSingle: async () => ({
      data: { id: "order", organization_id: "org" },
    }),
    single: async () => ({ data: { stripe_customer_id: "cus_test" } }),
  };
  const stripe = {
    webhooks: sdk.webhooks,
    paymentIntents: { retrieve: async () => ({ latest_charge: "ch_test" }) },
    charges: {
      retrieve: async () => ({
        id: "ch_test",
        amount_refunded: refunded,
        disputed: false,
      }),
    },
    checkout: {
      sessions: {
        retrieve: async () => ({
          id: "cs_test",
          mode: "payment",
          metadata: { application: "runfloor", order_id: "order" },
          customer: "cus_test",
          payment_status: paid ? "paid" : "unpaid",
          payment_intent: "pi_test",
          amount_total: 100,
          currency: "usd",
        }),
      },
    },
  };
  const deps = {
    "next/server": {
      NextResponse: {
        json: (body, options = {}) => ({ body, status: options.status ?? 200 }),
      },
    },
    "@/lib/ai-billing/stripe": {
      billingStripe: async () => ({
        stripe,
        account: "acct_test",
        live: false,
      }),
    },
    "@/lib/supabase/admin": {
      createAdminClient: () => ({
        from: () => query,
        rpc: async (name, args) => {
          calls.push({ name, args });
          return { error: null };
        },
      }),
    },
  };
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(
      readFileSync("src/app/api/stripe/webhook/route.ts", "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
    {
      exports,
      require: (name) => {
        assert.ok(name in deps, name);
        return deps[name];
      },
      process: { env: { RUNFLOOR_STRIPE_WEBHOOK_SECRET: secret } },
    },
  );
  const payload = JSON.stringify({
    id: "evt_test",
    type: "checkout.session.completed",
    livemode: live,
    ...(badAccount ? { account: "acct_wrong" } : {}),
    data: { object: { id: "cs_test" } },
  });
  return {
    calls,
    post: (valid = true) =>
      exports.POST(
        new Request("https://example.com/api/stripe/webhook", {
          method: "POST",
          body: payload,
          headers: {
            "stripe-signature": valid
              ? sdk.webhooks.generateTestHeaderString({ payload, secret })
              : "invalid",
          },
        }),
      ),
  };
}
test("verified paid webhook requests fulfillment with expected account and amount", async () => {
  const r = route();
  assert.equal((await r.post()).status, 200);
  assert.equal(r.calls.length, 1);
  assert.equal(r.calls[0].args.paid_cents, 100);
  assert.equal(r.calls[0].args.account_id, "acct_test");
});
test("unpaid checkout never grants credits", async () => {
  const r = route({ paid: false });
  assert.equal((await r.post()).status, 200);
  assert.equal(r.calls.length, 0);
});
test("invalid signatures, live events and foreign accounts never grant credits", async () => {
  for (const [options, valid] of [
    [{}, false],
    [{ live: true }, true],
    [{ badAccount: true }, true],
  ]) {
    const r = route(options);
    assert.equal((await r.post(valid)).status, 400);
    assert.equal(r.calls.length, 0);
  }
});

test("refunds preceding checkout delivery are passed into atomic fulfillment", async () => {
  const r = route({ refunded: 100 });
  assert.equal((await r.post()).status, 200);
  assert.equal(r.calls[0].args.refund_cents, 100);
});
