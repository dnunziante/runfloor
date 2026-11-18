export const UNITS_PER_CREDIT = 1_000_000;
export const UNITS_PER_DOLLAR = 100_000_000;
export type ModelRate = {
  input_units_per_million: number;
  cached_units_per_million: number;
  output_units_per_million: number;
};
export type Usage = {
  input: number;
  cached: number;
  output: number;
  reasoning: number;
};
const integer = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
export function providerUsage(data: unknown, embedding = false): Usage | null {
  const u = (data as { usage?: Record<string, unknown> })?.usage;
  if (!u) return null;
  const input = integer(
    u.prompt_tokens ?? (embedding ? u.total_tokens : undefined),
  );
  const output = embedding ? 0 : integer(u.completion_tokens);
  const cached = integer(
    (u.prompt_tokens_details as { cached_tokens?: unknown })?.cached_tokens ??
      0,
  );
  const reasoning = integer(
    (u.completion_tokens_details as { reasoning_tokens?: unknown })
      ?.reasoning_tokens ?? 0,
  );
  if (
    input === null ||
    output === null ||
    cached === null ||
    reasoning === null ||
    cached > input ||
    reasoning > output
  )
    return null;
  return { input, cached, output, reasoning };
}
export function costUnits(usage: Usage, rate: ModelRate): number {
  // Reasoning is already included in output. Integer microcredits avoid whole-credit rounding.
  const numerator =
    BigInt(usage.input - usage.cached) * BigInt(rate.input_units_per_million) +
    BigInt(usage.cached) * BigInt(rate.cached_units_per_million) +
    BigInt(usage.output) * BigInt(rate.output_units_per_million);
  return Number((numerator + BigInt(999999)) / BigInt(1000000));
}
export function boundRequest(path: string, payload: Record<string, unknown>) {
  const embedding = path === "embeddings";
  if (!embedding && path !== "chat/completions")
    throw new Error("AI request type has not been approved for metering.");
  const bounded = { ...payload };
  if (!embedding) {
    const requested = Number(payload.max_completion_tokens);
    bounded.max_completion_tokens = Number.isSafeInteger(requested) && requested > 0 ? Math.min(requested, 8192) : 8192;
    delete bounded.max_tokens;
  }
  const serialized = JSON.stringify(bounded);
  // A UTF-8 byte bound is deliberately conservative for text tokenization, including schemas.
  // Only inline images are allowed; their encoded bytes plus image overhead are reserved.
  const images = [...serialized.matchAll(/"url":"([^\"]+)"/g)].filter(() =>
    serialized.includes("image_url"),
  );
  if (images.some((match) => !match[1].startsWith("data:image/")))
    throw new Error("Remote images require explicit metering bounds.");
  const input =
    Buffer.byteLength(serialized, "utf8") + 4096 + images.length * 16384;
  if (input > 200_000)
    throw new Error(
      "This AI input is too large. Split the document into smaller files.",
    );
  return { payload: bounded, input, output: embedding ? 0 : Number(bounded.max_completion_tokens) };
}
export function creditLabel(units: number) {
  return (units / UNITS_PER_CREDIT).toLocaleString("en-US", {
    maximumFractionDigits: 6,
  });
}

export function validCreditSummary(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  return (
    [
      "included_remaining_units",
      "included_units",
      "used_units",
      "reserved_units",
      "purchased_units",
      "available_units",
    ].every(
      (key) => typeof s[key] === "number" && Number.isSafeInteger(s[key]),
    ) &&
    typeof s.can_manage === "boolean" &&
    typeof s.frozen === "boolean" &&
    ["period_start", "period_end"].every(
      (key) =>
        s[key] === null ||
        (typeof s[key] === "string" && Number.isFinite(Date.parse(s[key]))),
    )
  );
}
