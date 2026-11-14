import test from "node:test";
import assert from "node:assert/strict";
import { creditDatabase } from "./test-database.mjs";
const A = "10000000-0000-0000-0000-000000000001",
  B = "10000000-0000-0000-0000-000000000002",
  U = "20000000-0000-0000-0000-000000000001",
  V = "20000000-0000-0000-0000-000000000002",
  O = "20000000-0000-0000-0000-000000000003";
test("PostgreSQL credit isolation, reservations, settlement, rollover and payments", async (t) => {
  const db = await creditDatabase();
  let n = 0;
  const id = () => `30000000-0000-0000-0000-${String(++n).padStart(12, "0")}`;
  const q = async (sql, args = []) => await db.query(sql, args);
  const as = async (user) => {
    await db.exec(
      `reset role;set role authenticated;set request.jwt.claim.sub='${user}'`,
    );
  };
  const reserve = (r, user = U, org = A, input = 1000, output = 100) =>
    q(`select reserve_ai_usage($1,$2,$3,'assistant','gpt-5-mini',$4,$5) r`, [
      org,
      user,
      r,
      input,
      output,
    ]);
  try {
    await db.exec(
      `insert into organizations values('${A}'),('${B}');insert into auth.users values('${U}'),('${V}'),('${O}');insert into profiles values('${U}',false),('${V}',false),('${O}',true);insert into organization_memberships values('${A}','${U}','salesperson','active'),('${B}','${V}','tenant_admin','active');`,
    );
    await t.test(
      "members cannot read other company balances or mutate credits",
      async () => {
        await as(U);
        await assert.rejects(
          q("select get_ai_credit_summary($1)", [B]),
          /Access denied/,
        );
        await assert.rejects(
          q(
            `insert into ai_credit_grants(organization_id,kind,total_units,reference) values($1,'adjustment',999,'hack')`,
            [A],
          ),
          /permission denied/,
        );
        await assert.rejects(reserve(id()), /permission denied/);
        const row = await q("select get_ai_credit_summary($1) s", [A]);
        assert.equal(row.rows[0].s.available_units, 2000000000);
        await db.exec("reset role");
      },
    );
    const first = id();
    await t.test(
      "fractional usage settles once and reasoning is not charged twice",
      async () => {
        await reserve(first);
        const usage = await q(
          `select finish_ai_usage($1,'settled',1000,200,100,50,'req-safe') s`,
          [first],
        );
        assert.equal(usage.rows[0].s.charged_units, 40500);
        await q(
          `select finish_ai_usage($1,'settled',1000,200,100,50,'req-safe')`,
          [first],
        );
        assert.equal(
          (
            await q(
              "select used_units from ai_credit_grants where organization_id=$1 and kind=$2",
              [A, "included"],
            )
          ).rows[0].used_units,
          40500,
        );
        await assert.rejects(reserve(first), /Duplicate/);
      },
    );
    await t.test(
      "foreign users cannot reserve another tenant balance",
      async () => {
        await assert.rejects(reserve(id(), V, A), /Membership required/);
      },
    );
    await t.test(
      "member history hides other users and raw provider costs",
      async () => {
        const other = id();
        await reserve(other, O);
        await as(U);
        assert.equal(
          (await q("select id from ai_usage_requests")).rows.length,
          1,
        );
        await assert.rejects(
          q("select provider_cost_units from ai_usage_requests"),
          /permission denied/,
        );
        await db.exec("reset role");
        await q(`select finish_ai_usage($1,'released')`, [other]);
      },
    );
    await t.test(
      "uncertain results hold credits until explicit reconciliation",
      async () => {
        const r = id();
        await reserve(r);
        await q(`select finish_ai_usage($1,'uncertain')`, [r]);
        assert.equal(
          (await q("select state from ai_usage_requests where id=$1", [r]))
            .rows[0].state,
          "uncertain",
        );
        await q(`select finish_ai_usage($1,'released')`, [r]);
        assert.equal(
          (
            await q(
              "select reserved_units from ai_credit_grants where organization_id=$1",
              [A],
            )
          ).rows[0].reserved_units,
          0,
        );
      },
    );
    await t.test("concurrent reservations cannot overspend", async () => {
      await q(
        "update ai_credit_grants set total_units=used_units+45000 where organization_id=$1",
        [A],
      );
      const one = id(),
        two = id();
      const outcomes = await Promise.allSettled([reserve(one), reserve(two)]);
      assert.equal(outcomes.filter((x) => x.status === "fulfilled").length, 1);
      for (const r of [one, two])
        if (
          (await q("select id from ai_usage_requests where id=$1", [r])).rows
            .length
        )
          await q(`select finish_ai_usage($1,'released')`, [r]);
    });
    await t.test(
      "expired included credits never roll over and reset is idempotent",
      async () => {
        await q(
          `update ai_credit_grants set reference=reference||':old',expires_at=now()-interval '1 month',period_start=now()-interval '2 months' where organization_id=$1 and kind='included'`,
          [A],
        );
        await as(U);
        await q("select get_ai_credit_summary($1)", [A]);
        await q("select get_ai_credit_summary($1)", [A]);
        await db.exec("reset role");
        assert.equal(
          (
            await q(
              `select count(*)::int n from ai_credit_grants where organization_id=$1 and expires_at>now() and kind='included'`,
              [A],
            )
          ).rows[0].n,
          1,
        );
      },
    );
    let pack,
      order = id();
    await t.test(
      "payment fulfillment is account-checked and idempotent",
      async () => {
        pack = (
          await q(
            `insert into ai_credit_packs(name,credit_units,price_cents) values('Draft pack',100000000,2000) returning id`,
          )
        ).rows[0].id;
        await q(
          `insert into runfloor_billing_customers(organization_id,stripe_customer_id,stripe_account_id,livemode) values($1,'cus_test','acct_test',false)`,
          [A],
        );
        await q(
          `insert into ai_credit_orders(id,organization_id,user_id,pack_id,credit_units,price_cents,currency,stripe_session_id) values($1,$2,$3,$4,100000000,2000,'usd','cs_test')`,
          [order, A, U, pack],
        );
        await assert.rejects(
          q(
            `select apply_ai_credit_payment('evt_bad','paid',$1,'cs_test','pi_test',2000,'usd','wrong',false)`,
            [order],
          ),
          /Wrong billing/,
        );
        for (const event of ["evt_paid", "evt_paid", "evt_paid_2"])
          await q(
            `select apply_ai_credit_payment($1,'paid',$2,'cs_test','pi_test',2000,'usd','acct_test',false)`,
            [event, order],
          );
        assert.equal(
          (
            await q(
              `select count(*)::int n from ai_credit_grants where reference=$1`,
              ["purchase:" + order],
            )
          ).rows[0].n,
          1,
        );
      },
    );
    await t.test(
      "partial refunds and disputes revoke entitlements without erasing consumed debt",
      async () => {
        await q(
          `select apply_ai_credit_payment('evt_refund','refund',$1,null,'pi_test',0,'usd','acct_test',false,1000,false)`,
          [order],
        );
        assert.equal(
          (
            await q(
              `select revoked_units from ai_credit_grants where reference=$1`,
              ["purchase:" + order],
            )
          ).rows[0].revoked_units,
          50000000,
        );
        await q(
          `select apply_ai_credit_payment('evt_dispute','dispute',$1,null,'pi_test',0,'usd','acct_test',false,1000,true)`,
          [order],
        );
        assert.equal(
          (
            await q(
              `select revoked_units from ai_credit_grants where reference=$1`,
              ["purchase:" + order],
            )
          ).rows[0].revoked_units,
          100000000,
        );
      },
    );
    await t.test(
      "retail packs stay inactive without explicit approval",
      async () => {
        await as(U);
        assert.equal(
          (await q("select id from ai_credit_packs")).rows.length,
          0,
        );
        await assert.rejects(
          q(
            `select admin_ai_billing('approve_pack',null,$1,'approve retail price')`,
            [JSON.stringify({ id: pack, active: true })],
          ),
          /Platform owner/,
        );
        await db.exec("reset role");
      },
    );
    await t.test(
      "changed reset dates cannot mint an overlapping second allowance",
      async () => {
        await as(O);
        await q(
          `select admin_ai_billing('settings',$1,$2,'change future reset only')`,
          [
            A,
            JSON.stringify({
              included_units: 2000000000,
              reset_day: 14,
              frozen: false,
            }),
          ],
        );
        await q("select get_ai_credit_summary($1)", [A]);
        await db.exec("reset role");
        assert.equal(
          (
            await q(
              `select count(*)::int n from ai_credit_grants where organization_id=$1 and kind='included' and expires_at>now()`,
              [A],
            )
          ).rows[0].n,
          1,
        );
      },
    );
    await t.test(
      "refund notifications cannot erase an ongoing dispute",
      async () => {
        await q(
          `select apply_ai_credit_payment('evt_refund_after_dispute','refund',$1,null,'pi_test',0,'usd','acct_test',false,1500,false)`,
          [order],
        );
        assert.equal(
          (
            await q("select disputed from ai_credit_orders where id=$1", [
              order,
            ])
          ).rows[0].disputed,
          true,
        );
      },
    );
    await t.test(
      "subscription cycle and one-location limit are enforced",
      async () => {
        await as(O);
        await q(
          `select admin_approve_runfloor_plan('price_test',true,'test-only subscription approval')`,
        );
        await db.exec("reset role");
        await q(
          `select apply_runfloor_subscription('evt_sub',$1,'cus_test','sub_test','active',now(),now()+interval '1 month','price_test','acct_test',false)`,
          [A],
        );
        await q(
          `insert into locations(id,organization_id,is_active) values($1,$2,true)`,
          [id(), A],
        );
        await assert.rejects(
          q(
            `insert into locations(id,organization_id,is_active) values($1,$2,true)`,
            [id(), A],
          ),
          /one active location/,
        );
        await assert.rejects(
          q(
            `select apply_runfloor_subscription('evt_bad_price',$1,'cus_test','sub_test','active',now(),now()+interval '1 month','price_wrong','acct_test',false)`,
            [A],
          ),
          /not approved/,
        );
      },
    );
    await t.test(
      "concurrent subscription checkouts share one durable slot",
      async () => {
        const results = await Promise.all([
          q("select claim_runfloor_subscription_checkout($1,$2) s", [A, id()]),
          q("select claim_runfloor_subscription_checkout($1,$2) s", [A, id()]),
        ]);
        assert.equal(
          results[0].rows[0].s.request_id,
          results[1].rows[0].s.request_id,
        );
      },
    );
    await t.test(
      "warning thresholds are configurable and audited",
      async () => {
        await as(O);
        await q(
          `select admin_ai_billing('settings',$1,$2,'configure warning thresholds')`,
          [
            A,
            JSON.stringify({
              included_units: 2000000000,
              reset_day: 14,
              frozen: false,
              warn_at: [60, 85],
            }),
          ],
        );
        await db.exec("reset role");
        assert.deepEqual(
          (
            await q(
              "select warn_at from ai_billing_settings where organization_id=$1",
              [A],
            )
          ).rows[0].warn_at,
          [60, 85],
        );
      },
    );
    await t.test(
      "included credits are reserved before purchased credits",
      async () => {
        const request = id();
        await reserve(request);
        const allocated = await q(
          "select g.kind from ai_credit_allocations a join ai_credit_grants g on g.id=a.grant_id where a.request_id=$1",
          [request],
        );
        assert.ok(allocated.rows.every((row) => row.kind === "included"));
        await q(`select finish_ai_usage($1,'released')`, [request]);
      },
    );
    await t.test(
      "75 and 90 percent notices are emitted once per period",
      async () => {
        await q(
          "update ai_billing_settings set warn_at=array[75,90] where organization_id=$1",
          [A],
        );
        await q(
          `update ai_credit_grants set total_units=100000,used_units=89500 where organization_id=$1 and kind='included' and expires_at>now()`,
          [A],
        );
        const request = id();
        await reserve(request, U, A, 10, 10);
        await q(`select finish_ai_usage($1,'settled',10,0,10,0)`, [request]);
        await q(`select finish_ai_usage($1,'settled',10,0,10,0)`, [request]);
        assert.equal(
          (
            await q(
              "select count(*)::int n from ai_credit_notifications where organization_id=$1 and threshold in(75,90)",
              [A],
            )
          ).rows[0].n,
          2,
        );
        await q(
          `update ai_credit_grants set total_units=2000000000 where organization_id=$1 and kind='included' and expires_at>now()`,
          [A],
        );
      },
    );
    await t.test(
      "zero included allowance is a valid configuration",
      async () => {
        await as(O);
        await q(
          `select admin_ai_billing('settings',$1,$2,'zero allowance test only')`,
          [
            B,
            JSON.stringify({
              included_units: 0,
              reset_day: 1,
              frozen: false,
              warn_at: [75, 90],
            }),
          ],
        );
        const summary = await q("select get_ai_credit_summary($1) s", [B]);
        assert.equal(summary.rows[0].s.included_units, 0);
        await db.exec("reset role");
      },
    );
    await t.test(
      "provider bound violations freeze AI and verified overages reconcile atomically",
      async () => {
        const request = id();
        await reserve(request, U, A, 1, 1);
        const held = await q(
          `select finish_ai_usage($1,'settled',1000,0,100,0,'verified-overage') s`,
          [request],
        );
        assert.equal(held.rows[0].s.state, "uncertain");
        await as(O);
        const settled = await q(
          `select admin_reconcile_ai_usage($1,'settled',$2,'provider invoice verified overage') s`,
          [
            request,
            JSON.stringify({
              input: 1000,
              cached: 0,
              output: 100,
              reasoning: 0,
              provider_id: "verified-overage",
            }),
          ],
        );
        assert.equal(settled.rows[0].s.state, "settled");
        assert.equal(settled.rows[0].s.charged_units, 45000);
        await db.exec("reset role");
        assert.equal(
          (
            await q(
              "select frozen from ai_billing_settings where organization_id=$1",
              [A],
            )
          ).rows[0].frozen,
          true,
        );
      },
    );
    await t.test(
      "already-refunded payments never expose spendable purchased credits",
      async () => {
        const r = id();
        await q(
          `insert into ai_credit_orders(id,organization_id,user_id,pack_id,credit_units,price_cents,currency,stripe_session_id) values($1,$2,$3,$4,100000000,2000,'usd','cs_refunded_first')`,
          [r, A, U, pack],
        );
        await q(
          `select apply_ai_credit_payment('evt_refunded_first','paid',$1,'cs_refunded_first','pi_refunded_first',2000,'usd','acct_test',false,2000,false)`,
          [r],
        );
        const grant = await q(
          "select total_units,revoked_units from ai_credit_grants where reference=$1",
          ["purchase:" + r],
        );
        assert.equal(
          grant.rows[0].total_units - grant.rows[0].revoked_units,
          0,
        );
        assert.equal(
          (await q("select status from ai_credit_orders where id=$1", [r]))
            .rows[0].status,
          "refunded",
        );
      },
    );
  } finally {
    await db.close();
  }
});
