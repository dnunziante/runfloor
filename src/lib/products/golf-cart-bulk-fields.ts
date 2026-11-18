import type { ProductDTO } from "./types";

const specification = (product: ProductDTO, key: string) => String(product.specifications?.[key] ?? "");

export const golfCartBulkFields = [
  { label: "Product Type", value: (p) => p.productType === "competitor_product" ? "Competitor Product" : "Our Product" },
  { label: "Model Year", value: (p) => String(p.modelYear ?? "") },
  { label: "Manufacturer", value: (p) => p.manufacturer || p.brand || "" },
  { label: "Model", value: (p) => [p.name, p.modelVariant].filter((value, index, values) => value && values.indexOf(value) === index).join(" · ") || p.model },
  { label: "Length", value: (p) => specification(p, "overallLength") },
  { label: "Width", value: (p) => specification(p, "overallWidth") },
  { label: "Power", value: (p) => specification(p, "power") },
  { label: "Frame", value: (p) => specification(p, "frameMaterial") },
  { label: "Body Material", value: (p) => specification(p, "bodyMaterial") },
  { label: "Features", value: (p) => specification(p, "standardFeatures") || p.highlights.join("; ") },
] satisfies { label: string; value: (product: ProductDTO) => string }[];

export const golfCartBulkAliases: Record<string, string> = {
  manufacturer: "Brand",
  model: "Model Name",
  length: "Overall Length",
  width: "Overall Width",
  frame: "Frame Material",
  features: "Standard Features",
};
