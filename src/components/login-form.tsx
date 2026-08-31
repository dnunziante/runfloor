"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function LoginForm({ configured, demoMode, nextPath, initialError = "" }: { configured: boolean; demoMode: boolean; nextPath: string; initialError?: string }) {

  return (
    <div className="login-form">
      <div className="eyebrow">Welcome back</div>
      <h1>Sign in to your workspace</h1>
      <p>
        {demoMode
          ? "Local demo mode is enabled. Continue into the protected-layout demo."
          : configured
            ? "Use your organization account to continue."
            : "Workspace sign-in is not configured. Ask the platform owner to complete the deployment settings."}
      </p>
      <form action="/auth/login" className="form-stack" method="post" style={{ marginTop: 25 }}>
        <input name="next" type="hidden" value={nextPath} />
        <div>
          <label className="label" htmlFor="email">Work email</label>
          <input className="input" disabled={!configured && !demoMode} id="email" name="email" type="email" autoComplete="email" required={!demoMode} placeholder="you@dealership.com" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input className="input" disabled={!configured && !demoMode} id="password" name="password" type="password" autoComplete="current-password" required={!demoMode} placeholder="••••••••" />
        </div>
        {initialError && <p className="form-error" role="alert">{initialError}</p>}
        <button className="btn btn-primary" disabled={!configured && !demoMode} type="submit">
          {demoMode ? "Continue to demo" : "Sign in"} <ArrowRight size={16}/>
        </button>
        {!demoMode && <Link className="btn btn-ghost" href="/auth/forgot-password">Forgot password?</Link>}
      </form>
      {!demoMode && <div className="form-stack demo-access">
        <div className="login-divider"><span>or</span></div>
        <Link className="btn btn-secondary" href={`/demo?next=${encodeURIComponent(nextPath)}`}>Explore the demo <ArrowRight size={16}/></Link>
        <p className="demo-access-note">No account required. Demo activity uses sample information and cannot change your organization&apos;s data.</p>
      </div>}
      <div className="demo-note">
        {demoMode
          ? "Local demo mode is active and is automatically disabled in production."
          : configured
            ? "Authentication is handled securely by Supabase. Credentials are never stored in this page."
            : "Set the Supabase URL and publishable key in the deployment environment before inviting users."}
      </div>
    </div>
  );
}
