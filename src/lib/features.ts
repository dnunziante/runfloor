// Shared by server access checks and every tenant's navigation/UI. Re-enable
// this one flag and rebuild to restore the complete coaching module.
export const ENABLE_SALES_COACHING: boolean = false;

export function isSalesCoachingPath(href: string) {
  const path = href.split(/[?#]/, 1)[0].replace(/\/+$/, "");
  return ["/coach", "/training", "/objections", "/role-play", "/admin/coach", "/admin/training", "/api/coach", "/api/admin/coach"].some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
    || /^\/api\/knowledge\/documents\/[^/]+\/training$/.test(path);
}

export function isFeatureDestinationEnabled(href: string, coachingEnabled = ENABLE_SALES_COACHING) {
  return coachingEnabled || !isSalesCoachingPath(href);
}

export function assertSalesCoachingEnabled() {
  if (!ENABLE_SALES_COACHING) throw new Error("Sales Coaching is temporarily unavailable.");
}
