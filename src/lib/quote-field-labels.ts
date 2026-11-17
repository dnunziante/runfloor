export const defaultQuoteLabels = {
  vehiclePrice: "Vehicle price", accessories: "Accessories", docFees: "Dealer fees",
  delivery: "Delivery", salesTax: "Sales tax", destination: "Destination",
  tagTitleDmvFee: "Tag / title / DMV", discount: "Discount",
} as const;
export type QuoteField = keyof typeof defaultQuoteLabels;
export type QuoteLabels = Record<QuoteField, string>;
export const quoteFields = Object.keys(defaultQuoteLabels) as QuoteField[];

// Stored drafts may predate custom names or contain unexpected values.
export function restoreQuoteLabels(value: unknown): QuoteLabels {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.fromEntries(quoteFields.map(key => {
    const label = typeof source[key] === "string" ? source[key].replace(/\s+/g, " ").trim().slice(0, 60) : "";
    return [key, label || defaultQuoteLabels[key]];
  })) as QuoteLabels;
}
