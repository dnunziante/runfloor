"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, Eye, EyeOff, Lightbulb, LockKeyhole, Mail, Play, Users } from "lucide-react";

export function LoginForm({ configured, demoMode, nextPath, initialError = "" }: { configured: boolean; demoMode: boolean; nextPath: string; initialError?: string }) {
  const [showPassword, setShowPassword] = useState(false);
  return <div className="signin-form">
    <div className="eyebrow">Welcome back</div><h1>Sign in to RunFloor</h1>
    <p className="signin-subtitle">{demoMode ? "Local demo mode is enabled." : configured ? "Your dealership’s business workspace." : "Workspace sign-in is not configured."}</p>
    <form action="/auth/login" method="post">
      <input name="next" type="hidden" value={nextPath} />
      <label htmlFor="email">Work email</label><div className="signin-input-wrap"><Mail aria-hidden="true" /><input disabled={!configured && !demoMode} id="email" name="email" type="email" autoComplete="email" required={!demoMode} placeholder="you@dealership.com" /></div>
      <label htmlFor="password">Password</label><div className="signin-input-wrap"><LockKeyhole aria-hidden="true" /><input disabled={!configured && !demoMode} id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required={!demoMode} placeholder="Enter your password" /><button aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(value => !value)} type="button">{showPassword ? <EyeOff /> : <Eye />}</button></div>
      <div className="signin-options"><label><input name="remember" type="checkbox" /> Keep me signed in</label>{!demoMode && <Link href="/auth/forgot-password">Forgot password?</Link>}</div>
      {initialError && <p className="form-error" role="alert">{initialError}</p>}
      <button className="signin-submit" disabled={!configured && !demoMode} type="submit">{demoMode ? "Continue to demo" : "Sign in"} <ArrowRight aria-hidden="true" /></button>
    </form>
    {!demoMode && <><div className="signin-divider"><span>or</span></div><Link className="signin-demo-card" href={`/demo?next=${encodeURIComponent(nextPath)}`}><span className="signin-demo-title"><Play aria-hidden="true" fill="currentColor" /> Explore the demo <ArrowRight aria-hidden="true" /></span><small>See how RunFloor supports a dealership</small></Link></>}
    <div className="signin-proof"><div><Users aria-hidden="true" /><strong>Built for teams</strong><span>Connected dealership workflows</span></div><div><Lightbulb aria-hidden="true" /><strong>Clear guidance</strong><span>Approved knowledge in context</span></div><div><BarChart3 aria-hidden="true" /><strong>Stronger results</strong><span>Performance in one place</span></div></div>
    <div className="signin-tagline"><span /> Run your dealership forward <span /></div>
  </div>;
}
