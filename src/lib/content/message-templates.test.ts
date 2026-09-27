import assert from "node:assert/strict";
import test from "node:test";
import { populateTemplateVariables, templateRelevance, type MessageTemplate } from "./message-templates.ts";

test("fills known variables and preserves unknown variables", () => {
  assert.equal(
    populateTemplateVariables("Hi {{ first_name }} from {{dealership_name}} — {{sender_name}} — {{custom_field}}", { customerName: "Avery", dealershipName: "RunFloor", salespersonName: "Jordan" }),
    "Hi Avery from RunFloor — Jordan — {{custom_field}}",
  );
});

test("ranks templates using deterministic metadata", () => {
  const followUp: MessageTemplate = { id: "1", title: "Visit follow-up", body: "", category: "Follow-Up", tags: ["appointment"], updatedAt: "" };
  const service: MessageTemplate = { id: "2", title: "Service reminder", body: "", category: "Service", tags: [], updatedAt: "" };
  assert.ok(templateRelevance(followUp, "appointment follow up") > templateRelevance(service, "appointment follow up"));
});
