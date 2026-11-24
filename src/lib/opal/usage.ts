import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type OpalHelpAllowance = {
  eligible: boolean;
  period_kind: "trial" | "subscription" | null;
  limit_units: number;
  used_units: number;
  reserved_units: number;
  remaining_units: number;
  reset_at: string | null;
};

const integer = (value: unknown) => {
  const number = typeof value === "string" ? Number(value) : value;
  return typeof number === "number" && Number.isSafeInteger(number) && number >= 0
    ? number
    : null;
};

export function parseOpalHelpAllowance(value: unknown): OpalHelpAllowance | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const limit = integer(row.limit_units);
  const used = integer(row.used_units);
  const reserved = integer(row.reserved_units);
  const remaining = integer(row.remaining_units);
  const kind = row.period_kind;
  const resetAt = row.reset_at;
  if (
    typeof row.eligible !== "boolean" ||
    limit === null ||
    used === null ||
    reserved === null ||
    remaining === null ||
    (kind !== null && kind !== "trial" && kind !== "subscription") ||
    (resetAt !== null &&
      (typeof resetAt !== "string" || !Number.isFinite(Date.parse(resetAt))))
  )
    return null;
  return {
    eligible: row.eligible,
    period_kind: kind,
    limit_units: limit,
    used_units: used,
    reserved_units: reserved,
    remaining_units: remaining,
    reset_at: resetAt as string | null,
  };
}

export async function getOpalHelpAllowance(
  organizationId: string,
  userId: string,
): Promise<OpalHelpAllowance | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_opal_help_usage", {
    target_org: organizationId,
    target_user: userId,
  });
  if (error) return null;
  return parseOpalHelpAllowance(data);
}
