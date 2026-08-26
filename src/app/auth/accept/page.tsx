import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SetInvitationPasswordForm } from "@/components/set-invitation-password-form";

export default async function AcceptInvitationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?message=sign-in-to-accept-invite");

  return <main className="auth-shell"><section className="auth-card"><p className="eyebrow">You&apos;re invited</p><h1>Create your password</h1><p>Choose a password to finish joining RunFloor. You&apos;ll use it the next time you sign in.</p><SetInvitationPasswordForm/></section></main>;
}
