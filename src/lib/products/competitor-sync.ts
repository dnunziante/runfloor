export function normalizeCompetitorIdentity(value: string, brand = "") {
  const withoutBrand = brand ? value.replace(new RegExp(`^${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`, "i"), "") : value;
  return withoutBrand.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function productSourceHash(input: Record<string, unknown>) {
  const stable = Object.keys(input).sort().map((key) => [key, input[key] ?? null]);
  let hash = 2166136261; for (const char of JSON.stringify(stable)) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16);
}
