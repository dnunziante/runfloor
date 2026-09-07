"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { isLocalDemoMode, isSupabaseConfigured, publicDemoCookieName } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error: string };

export async function login(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  if (isLocalDemoMode()) {
    redirect("/dashboard");
  }

  if (!isSupabaseConfigured()) return { error: "Workspace sign-in is not configured." };

  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const requestedNext = String(formData.get("next") || "");
  const nextPath = requestedNext.startsWith("/") && !requestedNext.startsWith("//")
    ? requestedNext
    : "/dashboard";

  if (!email || !password) {
    console.warn("[auth/login] missing credentials", {
      hasEmail: Boolean(email),
      hasPassword: Boolean(password),
    });
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error("[auth/login] Supabase rejected sign-in", {
      code: error.code,
      name: error.name,
      status: error.status,
    });
    return { error: error.name === "AuthRetryableFetchError" || !error.status || error.status >= 500 ? "Sign-in could not reach the workspace. Please try again." : "The email or password is incorrect." };
  }

  console.info("[auth/login] sign-in accepted", { nextPath });
  (await cookies()).delete(publicDemoCookieName);

  redirect(nextPath);
}

export async function logout() {
  (await cookies()).delete(publicDemoCookieName);
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
