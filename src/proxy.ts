import { defaultPermissions, hasPagePermission } from "@/lib/auth/role-permissions";
import type { AppRole } from "@/lib/auth/viewer";
import { isFeatureDestinationEnabled } from "@/lib/features";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isLocalDemoMode, isSupabaseConfigured, publicDemoCookieName } from "@/lib/supabase/config";

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/api/stripe/webhook" || request.nextUrl.pathname.startsWith("/api/auth/")) return NextResponse.next();
  if (!isFeatureDestinationEnabled(request.nextUrl.pathname)) {
    if (request.nextUrl.pathname.startsWith("/api/") || request.method !== "GET") return NextResponse.json({ error: "Sales Coaching is temporarily unavailable." }, { status: 403 });
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  // Module restrictions apply before demo bypasses and authentication.
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
    membership?.role !== "tenant_admin" &&
    !(request.nextUrl.pathname === "/admin/settings/roles" || request.nextUrl.pathname.startsWith("/admin/settings/roles/"))
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!profile?.is_platform_owner && membership) {
    const { data: permissionRow, error: permissionError } = await supabase.from("organization_role_permissions").select("permissions").eq("organization_id", membership.organization_id).eq("role", membership.role).maybeSingle();
    if (permissionError) return NextResponse.json({ error: "Workspace permissions could not be verified. Try again shortly." }, { status: 503 });
    const permissions = permissionRow?.permissions ?? defaultPermissions(membership.role as AppRole);
    if (!hasPagePermission(membership.role as AppRole, request.nextUrl.pathname, permissions)) {
      if (request.method !== "GET" || request.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ error: "Your position does not have access to this area." }, { status: 403 });
      const denied = NextResponse.redirect(new URL("/dashboard?access=restricted", request.url));
      response.cookies.getAll().forEach(cookie => denied.cookies.set(cookie));
      return denied;
    }
  }
  const helpPath = request.nextUrl.pathname === "/help" || request.nextUrl.pathname.startsWith("/help/") || request.nextUrl.pathname === "/api/opal" || request.nextUrl.pathname.startsWith("/api/opal/") || request.nextUrl.pathname === "/admin/opal";
  if (membership && !helpPath && !request.nextUrl.pathname.startsWith("/billing")) {
    const { data: access, error } = await supabase.rpc("rv_access_state", { target_org: membership.organization_id, target_location: request.cookies.get("rf-billing-location")?.value || null });
    if (error && !(process.env.RUNFLOOR_RV_BILLING_ENABLED !== "true" && error.code === "PGRST202")) return NextResponse.json({ error: "Billing access could not be verified. Try again shortly." }, { status: 503 });
    if (!error && !access?.allowed) {
      if (request.nextUrl.pathname.startsWith("/api/") || request.method !== "GET") return NextResponse.json({ error: "Your location requires an active trial or subscription. Open Billing to upgrade.", billingUrl: "/billing" }, { status: 402 });
      const upgrade = NextResponse.redirect(new URL("/billing", request.url));
      response.cookies.getAll().forEach(cookie => upgrade.cookies.set(cookie));
      return upgrade;
    }
  }
  return response;
}

export const config = {
  matcher: [
    "/help/:path*",
    "/billing/:path*",
    "/ai-usage/:path*",
    "/messages/:path*",
    "/generator/:path*",
    "/knowledge/:path*",
    "/api/:path*",
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
    "/api/coach/:path*",
    "/api/admin/coach/:path*",
    "/api/knowledge/documents/:id/training",
    "/growth/:path*",
    "/operations/:path*",
    "/executive/:path*",
  ],
};
