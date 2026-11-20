import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { authDestination, safeAuthNext } from "@/lib/auth/redirects";

const emailTypes = new Set(["email", "signup", "invite", "recovery", "magiclink", "email_change"]);

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const params = requestUrl.searchParams;
  const fail = () => NextResponse.redirect(new URL("/auth/link-error", requestUrl.origin));
  if (params.has("error") || params.has("error_code")) return fail();
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  const next = safeAuthNext(params.get("next"));

  // Default Supabase invitation emails return tokens in the fragment, which is
  // never sent to this server. Let a dedicated browser page establish the SSR
  // cookie session before visiting any server-rendered onboarding page.
  if (!code && !tokenHash) {
    return NextResponse.redirect(new URL(`/auth/complete?next=${encodeURIComponent(next)}`, requestUrl.origin));
  }
  if (tokenHash && (!type || !emailTypes.has(type))) return fail();

  const { url, publishableKey } = getSupabaseConfig();
  const response = NextResponse.redirect(new URL(authDestination(type, next), requestUrl.origin));
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  try {
    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: type as EmailOtpType });
    if (error) return fail();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user || !user.email_confirmed_at) return fail();
    response.cookies.delete("commandly-public-demo");
    return response;
  } catch {
    return fail();
  }
}
