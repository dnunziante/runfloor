import type { SupabaseClient } from "@supabase/supabase-js";
import { authDestination } from "./redirects";

/** Tokens remain browser-local; only Supabase receives them for validation. */
export async function completeEmailLink(auth: SupabaseClient["auth"], hash: string, next: string | null) {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (params.has("error") || params.has("error_code") || !access_token || !refresh_token) return "/auth/link-error";
  try {
    const { error } = await auth.setSession({ access_token, refresh_token });
    if (error) return "/auth/link-error";
    const { data: { user }, error: userError } = await auth.getUser();
    if (userError || !user || !user.email_confirmed_at) return "/auth/link-error";
    return authDestination(params.get("type"), next);
  } catch {
    return "/auth/link-error";
  }
}
