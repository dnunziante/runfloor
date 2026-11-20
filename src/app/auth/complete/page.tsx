"use client";

import { useEffect, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig, publicDemoCookieName } from "@/lib/supabase/config";
import { completeEmailLink } from "@/lib/auth/complete-email-link";

export default function CompleteEmailLinkPage() {
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const hash = window.location.hash;
    const next = new URLSearchParams(window.location.search).get("next");
    // Remove credentials before rendering or loading another page. Never log them.
    window.history.replaceState(null, "", window.location.pathname);
    void (async () => {
      try {
        const { url, publishableKey } = getSupabaseConfig();
        const client = createBrowserClient(url, publishableKey, { isSingleton: false, auth: { detectSessionInUrl: false } });
        const destination = await completeEmailLink(client.auth, hash, next);
        if (destination !== "/auth/link-error") document.cookie = `${publicDemoCookieName}=; Path=/; Max-Age=0; SameSite=Lax`;
        window.location.replace(destination);
      } catch {
        window.location.replace("/auth/link-error");
      }
    })();
  }, []);
  return <main className="auth-shell"><section className="auth-card"><h1>Verifying your email link</h1><p role="status">Please wait while we securely finish signing you in.</p></section></main>;
}
