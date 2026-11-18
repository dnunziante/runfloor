"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { cookies } from "next/headers";

function validContactPhone(phone: string) {
  return !phone || (phone.length <= 40 && /^[+\d\s().xet#-]+$/i.test(phone) && (phone.match(/\d/g)?.length ?? 0) >= 7);
}

export async function signupTrial(_state: { message: string }, form: FormData) {
  const plan = form.get("plan") === "sales_solo" ? "sales_solo" : "complete";
  if ((plan === "sales_solo" ? process.env.RUNFLOOR_SALES_SOLO_ENABLED !== "true" : process.env.RUNFLOOR_RV_BILLING_ENABLED !== "true") || !isSupabaseConfigured()) return { message: "Trial registration is not yet available. You can explore the demo in the meantime." };
  const dealership = String(form.get("dealership") || "").trim();
  const fullName = String(form.get("fullName") || "").trim();
  const email = String(form.get("email") || "").trim();
  const password = String(form.get("password") || "");
  const phone = String(form.get("phone") || "").trim();
  if (dealership.length < 2 || dealership.length > 120 || fullName.length < 2 || fullName.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12 || password.length > 128) return { message: "Enter your dealership, contact name, valid email, and a password of 12–128 characters." };
  if (!validContactPhone(phone)) return { message: "Enter a valid phone number or leave the optional field blank." };
  const db = await createClient();
  const { data: { user: existing } } = await db.auth.getUser();
  if (existing) redirect("/signup/activate");
  const origin = process.env.APP_URL || process.env.RUNFLOOR_BILLING_ORIGIN;
  if (!origin) return { message: "Trial registration is temporarily unavailable." };
  const { data, error } = await db.auth.signUp({ email, password, options: { data: { full_name: fullName, contact_phone: phone || null }, emailRedirectTo: `${origin}/auth/callback?next=/signup/activate` } });
  if (error) return { message: "We couldn't register this account. Try again or sign in if you already have an account." };
  // The cookie contains presentation defaults only; activation always verifies auth.getUser.
  (await cookies()).set("rf-trial-draft", JSON.stringify({ dealership, fullName, phone, plan }), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/signup", maxAge: 86400 });
  if (data.session) redirect("/signup/activate");
  return { message: "Check your inbox for the verification link. Your trial starts only after you verify your email and activate your dealership." };
}

export async function activateTrial(_state: { message: string }, form: FormData) {
  const plan = form.get("plan") === "sales_solo" ? "sales_solo" : "complete";
  if (plan === "sales_solo" ? process.env.RUNFLOOR_SALES_SOLO_ENABLED !== "true" : process.env.RUNFLOOR_RV_BILLING_ENABLED !== "true") return { message: "Trial activation is not yet available." };
  const phone = String(form.get("phone") || "").trim();
  if (!validContactPhone(phone)) return { message: "Enter a valid phone number or leave the optional field blank." };
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user || !user.email_confirmed_at) return { message: "Verify your email and sign in before activating your trial." };
  const { error } = await createAdminClient().rpc(plan === "sales_solo" ? "activate_sales_solo" : "activate_rv_trial", { actor: user.id, [plan === "sales_solo" ? "company" : "dealership"]: String(form.get("dealership") || "").trim(), contact_name: String(form.get("fullName") || "").trim() });
  if (error) return { message: error.message.includes("already") ? "This account or dealership already belongs to a workspace. Sign in or ask its administrator for an invitation." : "We couldn't activate this dealership. Try again or contact support if it already exists." };
  if (phone) {
    const { error: profileError } = await db.from("profiles").update({ phone }).eq("id", user.id);
    if (profileError) return { message: "Your trial is activated, but your phone number could not be saved. Please try again." };
  }
  (await cookies()).set("rf-trial-draft", "", { path: "/signup", maxAge: 0, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  redirect(plan === "sales_solo" ? "/billing" : "/dashboard");
}
