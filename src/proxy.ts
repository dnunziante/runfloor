import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isLocalDemoMode, isSupabaseConfigured, publicDemoCookieName } from "@/lib/supabase/config";

export async function proxy(request: NextRequest) {
  const hasPublicDemoCookie = request.cookies.get(publicDemoCookieName)?.value === "1";

  if (isLocalDemoMode()) return NextResponse.next();

  if (!isSupabaseConfigured()) {
    if (hasPublicDemoCookie && !request.nextUrl.pathname.startsWith("/admin")) {
      return NextResponse.next();
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("configuration", "missing");
    return NextResponse.redirect(loginUrl);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (hasPublicDemoCookie) {
      if (request.nextUrl.pathname.startsWith("/admin")) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
      return response;
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  const [{ data: profile }, { data: memberships }, { data: workspaceContext }] = await Promise.all([
    supabase.from("profiles").select("is_platform_owner").eq("id", user.id).maybeSingle(),
    supabase
      .from("organization_memberships")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .eq("status", "active"),
    supabase.from("platform_workspace_contexts").select("active_organization_id").eq("user_id", user.id).maybeSingle(),
  ]);

  const membership = memberships?.find((item) => item.organization_id === workspaceContext?.active_organization_id) ?? memberships?.[0];

  if (!profile?.is_platform_owner && !membership) {
    const noAccessUrl = request.nextUrl.clone();
    noAccessUrl.pathname = "/no-access";
    noAccessUrl.search = "";
    return NextResponse.redirect(noAccessUrl);
  }

  if (
    request.nextUrl.pathname.startsWith("/admin") &&
    !profile?.is_platform_owner &&
    membership?.role !== "tenant_admin"
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/assistant/:path*",
    "/pricing-calculator/:path*",
    "/quote-calculator/:path*",
    "/products/:path*",
    "/competitors/:path*",
    "/comparisons/:path*",
    "/objections/:path*",
    "/email/:path*",
    "/text/:path*",
    "/role-play/:path*",
    "/training/:path*",
    "/knowledge-base/:path*",
    "/analytics/:path*",
    "/admin/:path*",
    "/coach/:path*",
    "/growth/:path*",
    "/operations/:path*",
    "/executive/:path*",
  ],
};
