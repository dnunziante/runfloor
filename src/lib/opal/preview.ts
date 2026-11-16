// Isolated development preview only. Never enabled by public demo cookies.
export function opalPreview() { return process.env.NODE_ENV !== "production" && process.env.OPAL_LOCAL_PREVIEW === "true"; }
