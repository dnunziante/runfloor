"use client";
import { useState } from "react";
import { updateAiBilling } from "./actions";
export function BillingAdminForm({
  companies,
}: {
  companies: { id: string; name: string }[];
}) {
  const [action, setAction] = useState("settings");
  const number = (name: string, label: string, value?: number) => (
    <label>
      {label}
      <input
        type="number"
        name={name}
        defaultValue={value}
        step="any"
        required
      />
    </label>
  );
  return (
    <form action={updateAiBilling} className="ai-admin-form">
      <label>
        Company
        <select name="organization">
          <option value="">Global setting</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Action
        <select
          name="action"
          value={action}
          onChange={(event) => setAction(event.target.value)}
        >
          <option value="settings">Company allowance and reset</option>
          <option value="adjustment">Credit adjustment</option>
          <option value="billing_admin">Billing administrator access</option>
          <option value="pack">Create inactive pack draft</option>
          <option value="approve_pack">Approve or deactivate pack</option>
          <option value="rate">New model pricing version</option>
          <option value="subscription">Approve subscription price</option>
          <option value="reconcile">Reconcile uncertain request</option>
        </select>
      </label>
      {action === "settings" && (
        <>
          {number("credits", "Monthly included credits", 2000)}
          {number("reset_day", "Monthly reset day (UTC, 1–28)", 1)}
          <label>
            Warning percentages, separated by commas
            <input name="warn_at" defaultValue="75,90" required />
          </label>
          <label>
            <input type="checkbox" name="enabled" /> Pause AI for this company
          </label>
        </>
      )}
      {action === "adjustment" && (
        <>
          {number("credits", "Credits to add (negative values subtract)")}
          <p>Adjustments are recorded permanently with your reason.</p>
        </>
      )}
      {action === "billing_admin" && (
        <>
          <label>
            Active member’s user ID
            <input name="record_id" required />
          </label>
          <label>
            <input type="checkbox" name="enabled" /> Grant billing-administrator
            access
          </label>
        </>
      )}
      {action === "pack" && (
        <>
          <label>
            Pack name
            <input name="name" required maxLength={120} />
          </label>
          {number("credits", "Credits in pack")}
          {number("price", "Retail price (USD)")}
          <label>
            Expiration in days (blank means no expiration)
            <input name="expires_days" type="number" min={1} />
          </label>
          <p>
            This creates an inactive draft. Customers cannot purchase it until
            separately approved.
          </p>
        </>
      )}
      {action === "approve_pack" && (
        <>
          <label>
            Pack ID
            <input name="record_id" required />
          </label>
          <label>
            <input type="checkbox" name="enabled" /> I approve this pack’s
            retail price and expiration policy and want it available for
            purchase
          </label>
        </>
      )}
      {action === "rate" && (
        <>
          <label>
            Exact provider model ID
            <input name="model" required />
          </label>
          <label>
            Pricing version
            <input name="version" required placeholder="YYYY-MM-DD revision" />
          </label>
          {number("input_price", "USD per million input tokens")}
          {number("cached_price", "USD per million cached input tokens")}
          {number("output_price", "USD per million output tokens")}
          <label>
            Verified pricing source URL
            <input name="source_url" type="url" required />
          </label>
        </>
      )}
      {action === "subscription" && (
        <>
          <label>
            Approved $99 monthly Stripe Price ID
            <input name="record_id" required />
          </label>
          <label>
            <input type="checkbox" name="enabled" /> Make the approved
            subscription available for purchase
          </label>
        </>
      )}
      {action === "reconcile" && (
        <>
          <label>
            Uncertain request ID
            <input name="record_id" required />
          </label>
          <label>
            Verified provider outcome
            <select name="outcome">
              <option value="settled">
                Provider billed usage—settle actual usage
              </option>
              <option value="released">
                Provider confirmed no billing—release reservation
              </option>
            </select>
          </label>
          {number("input_tokens", "Input tokens", 0)}
          {number("cached_tokens", "Cached input tokens", 0)}
          {number(
            "output_tokens",
            "Total output tokens, including reasoning",
            0,
          )}
          {number(
            "reasoning_tokens",
            "Reasoning tokens already included in total",
            0,
          )}
          <label>
            Provider request ID
            <input name="provider_id" />
          </label>
          <p>
            Use verified provider usage only. Do not release a reservation just
            because the browser timed out.
          </p>
        </>
      )}
      <label>
        Audit reason
        <textarea
          name="reason"
          rows={3}
          minLength={10}
          maxLength={1000}
          required
        />
      </label>
      <button className="btn btn-primary">Save audited change</button>
    </form>
  );
}
