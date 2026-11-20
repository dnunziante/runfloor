/** Reject protocol-relative paths, backslashes and control characters before URL resolution. */
export function safeAuthNext(value?: string | null, fallback = "/dashboard") {
  return value?.startsWith("/") && !value.startsWith("//") && !/[\\\x00-\x20\x7f]/.test(value) ? value : fallback;
}

export function authDestination(type: string | null, next?: string | null) {
  if (type === "invite") return "/auth/accept";
  if (type === "recovery") return "/auth/reset-password";
  return safeAuthNext(next);
}

export function authOrigin() {
  const value = process.env.APP_URL || process.env.RUNFLOOR_BILLING_ORIGIN;
  if (!value) throw new Error("Authentication origin is not configured.");
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
      (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) {
    throw new Error("Authentication origin must be a trusted HTTPS origin.");
  }
  return url.origin;
}
