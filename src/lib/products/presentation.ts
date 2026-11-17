import type { ProductDTO } from "./types.ts";

// Imported catalogs historically use zero as the missing MSRP sentinel.
export function productPrice(product: Pick<ProductDTO, "price" | "salePrice">): number | null {
 if (product.salePrice != null && Number.isFinite(product.salePrice) && product.salePrice >= 0) return product.salePrice;
 return Number.isFinite(product.price) && product.price > 0 ? product.price : null;
}
export function productTitle(product: Pick<ProductDTO, "name" | "model" | "modelYear" | "brand" | "modelVariant">) {
 const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
 let title = product.name.trim();
 const model = (product.modelVariant || product.model).trim();
 if (model && normalized(model).includes(normalized(title))) title = model;
 else if (model && !normalized(title).includes(normalized(model))) {
  const words = model.split(/\s+/); const existing = normalized(title).split(" ");
  let overlap = Math.min(words.length, existing.length);
  while (overlap && existing.slice(-overlap).join(" ") !== normalized(words.slice(0,overlap).join(" "))) overlap--;
  title = [title,words.slice(overlap).join(" ")].filter(Boolean).join(" ");
 }
 const brand = product.brand?.trim() || "";
 if (brand && !normalized(title).includes(normalized(brand))) title = `${brand} ${title}`;
 if (product.modelYear && !new RegExp(`\\b${product.modelYear}\\b`).test(title)) title = `${product.modelYear} ${title}`;
 return title;
}
export function rvCategory(value: string) {
 const key = value.trim().toLowerCase().replace(/[-_]+/g," ").replace(/s$/, "");
 const names: Record<string,string> = { "fifth wheel":"Fifth Wheel", "travel trailer":"Travel Trailer", "toy hauler":"Toy Hauler", "class a":"Class A", "class a motorhome":"Class A", "class b":"Class B", "class b motorhome":"Class B", "class c":"Class C", "class c motorhome":"Class C", "truck camper":"Truck Camper", "pop up camper":"Pop-Up Camper", "folding camper":"Pop-Up Camper", "destination trailer":"Destination Trailer" };
 return names[key] || "Other RV";
}
const internalSpecification = /derived|source|import|confidence|extraction|template|row.?id|verified.?at|updated.?at/i;
export function visibleSpecification(key: string) { return !internalSpecification.test(key); }
export function specificationValue(key: string, value: string | number | boolean | null) {
 if (value == null || value === "") return "Not provided";
 if (typeof value === "boolean") return value ? "Yes" : "No";
 if (typeof value === "number" || /^\d+(\.\d+)?$/.test(String(value))) {
  const number = Number(value);
  if (/lengthft|heightft|widthft/i.test(key)) { const inches = Math.round(number * 12); return `${Math.floor(inches / 12)} ft ${inches % 12} in`; }
  if (/lb[s]?$|gvwr$|dryWeight$|hitchWeight$|shippingWeight$|carryingCapacity$/i.test(key)) return `${number.toLocaleString("en-US")} lb`;
  if (/gal$/i.test(key)) return `${number.toLocaleString("en-US")} gal`;
 }
 return String(value);
}
