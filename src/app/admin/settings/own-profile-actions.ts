"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
export async function saveOwnProfile(_state: { error: string; success: string }, form: FormData) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: "Sign in to update your profile.", success: "" };
  const name = String(form.get("name") || "").trim();
  const password = String(form.get("password") || "");
  if (name.length < 2 || name.length > 120 || (password && (password.length < 12 || password.length > 128))) return { error: "Enter a name and an optional password of 12–128 characters.", success: "" };
  if (password) { const { error } = await db.auth.updateUser({ password }); if (error) return { error: "Password could not be changed. Sign in again and retry.", success: "" }; }
  const { error } = await db.from("profiles").update({ full_name: name }).eq("id", user.id);
  if (error) return { error: password ? "Password changed, but your name could not be saved. Retry the name update." : "Your profile could not be saved.", success: "" };
  revalidatePath("/admin/settings");
  return { error: "", success: password ? "Your profile and password were updated." : "Your profile was updated." };
}
