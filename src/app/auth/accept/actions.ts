"use server";

import { getPendingInvitation } from "@/lib/auth/pending-invitation";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SetInvitationPasswordState = { error: string };

export async function setInvitationPassword(
  _previousState: SetInvitationPasswordState,
  formData: FormData,
): Promise<SetInvitationPasswordState> {
  const password = String(formData.get("password") || "");
  const confirmation = String(formData.get("confirmation") || "");

  if (password.length < 12 || password.length > 128) return { error: "Use 12–128 characters for your password." };
  if (password !== confirmation) return { error: "The passwords do not match." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Your invitation session has expired. Ask an administrator to send a new invitation." };

  try {
    if (!(await getPendingInvitation(user))) return { error: "This invitation has expired, was already accepted, or is no longer available. Ask your administrator for help." };
  } catch {
    return { error: "Your invitation could not be checked. Please try again." };
  }

  const { error: passwordError } = await supabase.auth.updateUser({ password });
  if (passwordError) return { error: "Your password could not be saved. Please try again." };

  const { error: invitationError } = await supabase.rpc("accept_organization_invitation");
  if (invitationError) return { error: "Your password was saved, but this invitation is no longer available. Ask an administrator for a new invitation." };

  redirect("/dashboard?invited=1");
}
