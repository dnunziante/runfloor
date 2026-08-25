export type ApprovedProduct = {
  id: string; name: string; model: string; description: string; base_price_cents: number;
  product_type?: "our_product" | "competitor_product";
  range_text: string; seats_text: string; powertrain_text: string; dimensions: string | null;
  running_distance: string | null; turning_radius: string | null; max_load_capacity: string | null;
  highlights: string[]; sales_guide: Record<string, unknown>;
  specifications?: Record<string, string>;
};

const ignoredWords = new Set(["a", "about", "and", "are", "can", "do", "for", "have", "how", "i", "in", "is", "it", "me", "of", "on", "price", "tell", "the", "to", "what", "with", "you"]);

function terms(value: string) {
  return value.toLowerCase().match(/[a-z0-9]+/g)?.filter((term) => term.length > 1 && !ignoredWords.has(term)) ?? [];
}

function searchableText(product: ApprovedProduct) {
  return [product.name, product.model, product.description, product.range_text, product.seats_text, product.powertrain_text, product.dimensions, product.running_distance, product.turning_radius, product.max_load_capacity, ...product.highlights, JSON.stringify(product.specifications || {}), JSON.stringify(product.sales_guide)].filter(Boolean).join(" ").toLowerCase();
}

export function selectRelevantProducts(question: string, products: ApprovedProduct[], limit = 12) {
  const queryTerms = terms(question);
  const asksForCatalog = /\b(products?|models?|catalog|inventory|offer|available)\b/i.test(question);
  return products.map((product, index) => {
    const text = searchableText(product);
    const name = `${product.name} ${product.model}`.toLowerCase();
    const score = queryTerms.reduce((total, term) => total + (name.includes(term) ? 5 : text.includes(term) ? 1 : 0), 0);
    return { product, score, index };
  }).filter(({ score }) => score > 0 || asksForCatalog || (!queryTerms.length && products.length <= limit))
    .sort((a, b) => b.score - a.score || a.index - b.index).slice(0, limit).map(({ product }) => product);
}

function guideLines(guide: Record<string, unknown>) {
  return Object.entries(guide).flatMap(([key, value]) => {
    if (typeof value === "string" && value.trim()) return [`${key}: ${value.trim()}`];
    if (Array.isArray(value) && value.length) return [`${key}: ${value.filter((item) => typeof item === "string").join("; ")}`];
    return [];
  });
}

export function formatProductContext(product: ApprovedProduct, priceOverrideCents?: number | null) {
  const priceCents = priceOverrideCents ?? product.base_price_cents;
  const details = [
    `Name: ${product.name}`, product.model && `Model: ${product.model}`,
    product.description && `Description: ${product.description}`,
    priceCents > 0 && `Approved price: $${(priceCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    product.range_text && `Range: ${product.range_text}`, product.seats_text && `Seats: ${product.seats_text}`,
    product.powertrain_text && `Powertrain: ${product.powertrain_text}`, product.dimensions && `Dimensions: ${product.dimensions}`,
    product.running_distance && `Running distance: ${product.running_distance}`, product.turning_radius && `Turning radius: ${product.turning_radius}`,
    product.max_load_capacity && `Maximum load: ${product.max_load_capacity}`, product.highlights.length && `Highlights: ${product.highlights.join("; ")}`,
    ...Object.entries(product.specifications || {}).filter(([, value]) => Boolean(value)).map(([key, value]) => `${key.replace(/([A-Z])/g, " $1")}: ${value}`),
    ...guideLines(product.sales_guide),
  ].filter(Boolean);
  const sourceLabel = product.product_type === "competitor_product" ? "Competitor reference" : "Product catalog";
  return `${sourceLabel} — ${product.name}${product.model ? ` — ${product.model}` : ""}\n${details.join("\n")}`;
}
