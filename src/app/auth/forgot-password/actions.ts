"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type PasswordRecoveryState = { error: string; success: string };

export async function requestPasswordRecovery(
  _previousState: PasswordRecoveryState,
  formData: FormData,
): Promise<PasswordRecoveryState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter a valid email address.", success: "" };

  const requestHeaders = await headers();
  const protocol = requestHeaders.get("x-forwarded-proto") || "http";
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
  const isLocalHost = host?.startsWith("localhost:") || host?.startsWith("127.0.0.1:");
  // Supabase only accepts configured return URLs. For local development, use the
  // configured Site URL so password resets can still be delivered safely.
  const redirectTo = host && !isLocalHost ? `${protocol}://${host}/auth/callback?next=/auth/reset-password` : undefined;
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) {
    console.error("Password reset email request failed", { code: error.code, message: error.message });
    if (error.code === "over_email_send_rate_limit") return { error: "Too many reset emails were requested. Please wait a few minutes, then try again.", success: "" };
    if (/redirect|url/i.test(error.message)) return { error: "Password reset is not configured for this site address yet. Please contact your administrator.", success: "" };
    return { error: "We could not send the reset email. Please try again.", success: "" };
  }

  return { error: "", success: "If that email has an account, a password-reset link is on its way." };
}
