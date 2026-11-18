import "server-only";
import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { AsyncLocalStorage } from "node:async_hooks";
import { getViewer } from "@/lib/auth/viewer";
import { createAdminClient } from "@/lib/supabase/admin";
import { boundRequest, providerUsage } from "./money";
type BillingContext = { organizationId: string; userId: string; locationId?: string | null };
const contexts = new AsyncLocalStorage<BillingContext>();
export function withAiBillingContext<T>(
  context: BillingContext,
  work: () => Promise<T>,
) {
  return contexts.run(context, work);
}
export class AiCreditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiCreditError";
  }
}
export async function meteredOpenAI(
  path: string,
  payload: Record<string, unknown>,
  operation = "ai_request",
) {
  const key = process.env.OPENAI_API_KEY;
  if (!key)
    throw new AiCreditError("The secure OpenAI connection is not configured.");
  const viewer = contexts.getStore() ? null : await getViewer();
  const context =
    contexts.getStore() ??
    (viewer && !viewer.demo
      ? { organizationId: viewer.organizationId, userId: viewer.id }
      : null);
  if (!context)
    throw new AiCreditError(
      "Sign in to a company workspace to use AI credits.",
    );
  const bounds = boundRequest(path, payload);
  const admin = createAdminClient();
  const fingerprint = createHash("sha256")
    .update(JSON.stringify([path, operation, bounds.payload]))
    .digest("hex");
  let incoming: string | null = null;
  try { incoming = (await headers()).get("x-runfloor-ai-request"); } catch { /* Background jobs use their explicit billing context. */ }
  const nonce =
    incoming && /^[0-9a-f-]{36}$/i.test(incoming)
      ? incoming
      : crypto.randomUUID();
  const digest = createHash("sha256")
    .update(
      [
        context.organizationId,
        context.userId,
        nonce,
        operation,
        fingerprint,
      ].join(":"),
    )
    .digest("hex");
  const id = [
    digest.slice(0, 8),
    digest.slice(8, 12),
    digest.slice(12, 16),
    digest.slice(16, 20),
    digest.slice(20, 32),
  ].join("-");
  let location = context.locationId ?? null;
  if (process.env.RUNFLOOR_RV_BILLING_ENABLED === "true" && !contexts.getStore()) {
    location = (await cookies()).get("rf-billing-location")?.value || null;
  }
  const { error: reserveError } = await admin.rpc("reserve_ai_usage", {
    target_org: context.organizationId,
    target_user: context.userId,
    request_id: id,
    feature: operation,
    target_model: String(payload.model ?? ""),
    max_input: bounds.input,
    max_output: bounds.output,
    input_fingerprint: fingerprint,
    ...(process.env.RUNFLOOR_RV_BILLING_ENABLED === "true" ? { target_location: location } : {}),
  });
  if (reserveError)
    throw new AiCreditError(
      reserveError.message.includes("Sales Solo") ? reserveError.message : reserveError.message.includes("Insufficient")
        ? "Your company has insufficient AI credits for this request. Open AI Usage & Billing to buy more."
        : "AI credit accounting is unavailable or this model needs configured pricing. No AI request was sent.",
    );
  let response: Response;
  try {
    response = await fetch(`https://api.openai.com/v1/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "X-Client-Request-Id": id,
      },
      body: JSON.stringify(bounds.payload),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    await admin.rpc("finish_ai_usage", {
      request_id: id,
      outcome: "uncertain",
    });
    throw new AiCreditError(
      "The AI provider did not confirm the result. Credits remain reserved for review; do not repeat the same operation immediately.",
    );
  }
  const data = await response.json().catch(() => null);
  const usage = providerUsage(data, path === "embeddings");
  // Missing usage and ambiguous provider failures retain their reservations. Never assume they were free.
  const unbilledRejection =
    !response.ok &&
    [400, 401, 403, 404, 413, 422, 429].includes(response.status) &&
    !usage;
  const { data: settled, error: settlementError } = await admin.rpc(
    "finish_ai_usage",
    {
      request_id: id,
      outcome: usage ? "settled" : unbilledRejection ? "released" : "uncertain",
      actual_input: usage?.input ?? 0,
      cached_input: usage?.cached ?? 0,
      actual_output: usage?.output ?? 0,
      reasoning_output: usage?.reasoning ?? 0,
      provider_id: response.headers.get("x-request-id"),
    },
  );
  if (settlementError || settled?.state === "uncertain")
    throw new AiCreditError(
      "AI usage requires reconciliation. Credits remain reserved; contact your administrator.",
    );
  if (!response.ok)
    throw new AiCreditError(
      "The AI provider rejected this request. Check your settings and try again.",
    );
  return data;
}
