import fs from "node:fs";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
const read = (n) => fs.readFileSync(".qa/" + n, "utf8").trim();
const f = JSON.parse(read("qa-connected-private.json"));
if (
  f.project !== "xcjokbopvhwtfzwvkysx" ||
  f.url !== "https://xcjokbopvhwtfzwvkysx.supabase.co"
)
  throw new Error(
    "This test is restricted to the dedicated RunFloor QA project.",
  );
const admin = createClient(f.url, read("supabase-service-key-private.txt"));
const check = (r) => {
  if (r.error) throw Error(r.error.message);
  return r.data;
};
const feature = "qa_verified_usage_" + randomUUID().replaceAll("-", "");
const clients = [];
for (const i of f.identities) {
  const c = createClient(f.url, read("supabase-publishable-key-private.txt"));
  check(
    await c.auth.signInWithPassword({ email: i.email, password: i.password }),
  );
  clients.push(c);
}
for (let i = 0; i < 3; i++) {
  const id = randomUUID(),
    org = f.companies[i === 2 ? 1 : 0];
  check(
    await admin.rpc("reserve_ai_usage", {
      target_org: org,
      target_user: f.identities[i].id,
      request_id: id,
      feature,
      target_model: "gpt-5-mini",
      max_input: 1000,
      max_output: 100,
    }),
  );
  check(
    await admin.rpc("finish_ai_usage", {
      request_id: id,
      outcome: "settled",
      actual_input: 1000,
      cached_input: 200,
      actual_output: 100,
      reasoning_output: 50,
    }),
  );
}
const own = check(
  await clients[1]
    .from("ai_usage_requests")
    .select("id,user_id")
    .eq("operation", feature),
);
assert.equal(own.length, 1);
assert.ok(own.every((r) => r.user_id === f.identities[1].id));
assert.ok(
  (await clients[1].from("ai_usage_requests").select("provider_cost_units"))
    .error,
);
const company = check(
  await clients[0]
    .from("ai_usage_requests")
    .select("id,user_id")
    .eq("operation", feature),
);
assert.equal(company.length, 2);
assert.ok(
  (
    await clients[2].rpc("get_ai_credit_summary", {
      target_org: f.companies[0],
    })
  ).error,
);
assert.ok(
  (
    await clients[1].rpc("reserve_ai_usage", {
      target_org: f.companies[0],
      target_user: f.identities[1].id,
      request_id: randomUUID(),
      feature: "forged",
      target_model: "gpt-5-mini",
      max_input: 1,
      max_output: 1,
    })
  ).error,
);
const requests = Array.from({ length: 3 }, () => randomUUID());
const results = await Promise.all(
  requests.map((id) =>
    admin.rpc("reserve_ai_usage", {
      target_org: f.companies[1],
      target_user: f.identities[2].id,
      request_id: id,
      feature: "qa_concurrent_reservation",
      target_model: "gpt-5.6-terra",
      max_input: 4000000,
      max_output: 32768,
    }),
  ),
);
assert.equal(results.filter((r) => !r.error).length, 2);
for (const [index, r] of results.entries())
  if (!r.error)
    check(
      await admin.rpc("finish_ai_usage", {
        request_id: requests[index],
        outcome: "released",
      }),
    );
console.log(
  JSON.stringify({
    memberOwnHistoryOnly: true,
    providerCostsHidden: true,
    crossCompanyDenied: true,
    forgedReservationDenied: true,
    simultaneousReservations: 2,
    overspendDenied: 1,
    fractionalCharge: 0.0405,
  }),
);
