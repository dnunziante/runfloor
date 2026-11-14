import fs from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const project = "xcjokbopvhwtfzwvkysx",
  url = `https://${project}.supabase.co`;
const read = (name) => fs.readFileSync(".qa/" + name, "utf8").trim();
const admin = createClient(url, read("supabase-service-key-private.txt"), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const check = (result) => {
  if (result.error) throw new Error(result.error.message);
  return result.data;
};
const saved = fs.existsSync(".qa/qa-identities-private.json")
  ? JSON.parse(read("qa-identities-private.json"))
  : null;
const identities = saved ?? [];
for (const [index, role] of [
  "tenant_admin",
  "salesperson",
  "tenant_admin",
].entries())
  if (!identities[index]) {
    const email = `runfloor-billing-qa-${index}@example.com`,
      password = randomBytes(24).toString("base64url");
    const { user } = check(
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: `QA ${role} ${index}` },
      }),
    );
    identities.push({ id: user.id, email, password, role });
    fs.writeFileSync(
      ".qa/qa-identities-private.json",
      JSON.stringify(identities),
    );
  }
const companies = [];
for (let i = 0; i < 2; i++) {
  const rows = check(
    await admin
      .from("organizations")
      .upsert(
        {
          name: `RunFloor Billing QA ${i + 1}`,
          slug: `runfloor-billing-qa-${i + 1}`,
        },
        { onConflict: "slug" },
      )
      .select("id"),
  );
  companies.push(rows[0].id);
}
for (const [index, user] of identities.entries()) {
  check(
    await admin
      .from("organization_memberships")
      .upsert(
        {
          organization_id: companies[index === 2 ? 1 : 0],
          user_id: user.id,
          role: user.role,
          status: "active",
        },
        { onConflict: "organization_id,user_id" },
      ),
  );
}
const user = createClient(url, read("supabase-publishable-key-private.txt"), {
  auth: { persistSession: false, autoRefreshToken: false },
});
check(await user.auth.signInWithPassword(identities[0]));
const summary = check(
  await user.rpc("get_ai_credit_summary", { target_org: companies[0] }),
);
fs.writeFileSync(
  ".qa/qa-connected-private.json",
  JSON.stringify({ project, url, companies, identities }),
);
console.log(
  JSON.stringify({
    companies: companies.length,
    users: identities.length,
    includedCredits: summary.included_units / 1000000,
    canManage: summary.can_manage,
  }),
);
