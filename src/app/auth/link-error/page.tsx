import Link from "next/link";

export default function EmailLinkErrorPage() {
  return <main className="auth-shell"><section className="auth-card"><h1>This email link could not be verified</h1><p role="alert">The link may have expired, already been used, or been opened in a different browser from the one where you registered.</p><p>For an employee invitation, ask your administrator to send a fresh link. If you already finished setting up your account, sign in.</p><p>For trial registration, return to signup or sign in with your verified account to continue activation. For a password reset, request a new reset email.</p><p><Link href="/login">Sign in</Link> · <Link href="/signup">Trial registration</Link> · <Link href="/auth/forgot-password">Reset password</Link></p></section></main>;
}
