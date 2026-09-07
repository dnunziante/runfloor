import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseConfig, publicDemoCookieName } from "@/lib/supabase/config";

function loginRedirect(request: NextRequest, nextPath: string, error: "credentials" | "network") {
  const url = new URL("/login", request.url);
  url.searchParams.set("next", nextPath);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const requestedNext = String(formData.get("next") || "");
  const nextPath = requestedNext.startsWith("/") && !requestedNext.startsWith("//")
    ? requestedNext
    : "/dashboard";

  if (!email || !password) return loginRedirect(request, nextPath, "credentials");

  const response = NextResponse.redirect(new URL(nextPath, request.url), 303);
  const { url, publishableKey } = getSupabaseConfig();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return loginRedirect(request, nextPath, error.name === "AuthRetryableFetchError" || !error.status || error.status >= 500 ? "network" : "credentials");
  } catch {
    return loginRedirect(request, nextPath, "network");
  }

  response.cookies.delete(publicDemoCookieName);
  return response;
}
