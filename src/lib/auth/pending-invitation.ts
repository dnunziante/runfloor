import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Invited users have no active workspace yet and cannot read invitation records
// through RLS. Scope the server-only lookup to the verified Auth identity.
export async function getPendingInvitation(user: { id: string; email?: string; email_confirmed_at?: string }) {
  if (!user.email || !user.email_confirmed_at) return null;
  const admin = createAdminClient();
  const { data: invitation, error } = await admin.from("organization_invitations")
    .select("id, organization_id")
    .eq("auth_user_id", user.id)
    .eq("email", user.email.toLowerCase())
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error("Invitation status could not be checked. Please try again.");
  if (!invitation) return null;
  const { data: membership, error: membershipError } = await admin.from("organization_memberships")
    .select("status").eq("organization_id", invitation.organization_id).eq("user_id", user.id).maybeSingle();
  if (membershipError) throw new Error("Workspace access could not be checked. Please try again.");
  if (membership?.status === "suspended") return null;
  return invitation;
}
