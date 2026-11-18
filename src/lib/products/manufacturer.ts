import type { ProductDTO } from "./types";

type ManufacturerFields = Pick<ProductDTO, "manufacturer" | "brand">;

function manufacturerName(product: ManufacturerFields) {
  return (product.manufacturer?.trim() || product.brand?.trim() || "").replace(/\s+/g, " ");
}

export function manufacturerLabel(product: ManufacturerFields) {
  return manufacturerName(product) || "Manufacturer not provided";
}

export function manufacturerKey(product: ManufacturerFields) {
  const name = manufacturerName(product);
  return name ? `manufacturer:${name.toLowerCase()}` : "missing";
}

export function manufacturerOptions(products: ManufacturerFields[]) {
  const names = new Map<string, string>();
  for (const product of products) {
    const key = manufacturerKey(product);
    if (!names.has(key)) names.set(key, manufacturerLabel(product));
  }
  return [...names].sort(([, left], [, right]) => left.localeCompare(right));
}
