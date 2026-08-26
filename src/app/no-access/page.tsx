import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { logout } from "@/app/auth/actions";

export default function NoAccessPage() {
  return <main className="hero"><div className="hero-inner">
    <div className="no-access-logo" aria-label="RunFloor">RunFloor</div>
    <ShieldAlert size={42} color="#c94f0a"/>
    <h1 style={{marginTop:18}}>Your account needs a workspace</h1>
    <p>Your login is valid, but an administrator has not assigned you to an organization yet.</p>
    <div className="hero-actions"><Link className="btn btn-ghost" href="/">Return home</Link><form action={logout}><button className="btn btn-primary" type="submit">Sign out</button></form></div>
  </div></main>;
}
