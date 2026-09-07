import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { LibraryScope } from "./library";

// Compatibility for the brief interval between code preparation and migration activation.
export const isProcedureLibraryReady = cache(async (scope: LibraryScope) => {
  const client = await createClient();
  const { error } = await client.from(scope === "platform" ? "platform_procedure_categories" : "operations_procedure_categories").select("archived_at").limit(0);
  if (error && !["42703", "42P01", "PGRST204", "PGRST205"].includes(error.code)) throw new Error("The procedure library is temporarily unavailable. Please try again.");
  return !error;
});

export function activeProcedureRows<T extends { is: (column: string, value: null) => unknown }>(query: T, ready: boolean): T {
  return ready ? query.is("archived_at", null) as T : query;
}
