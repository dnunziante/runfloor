export type MessageTemplateKind = "email" | "text";

export type MessageTemplate = {
  id: string;
  title: string;
  body: string;
  category: string;
  tags: string[];
  updatedAt: string;
};

export type TemplateVariables = {
  customerName?: string;
  productName?: string;
  salespersonName?: string;
  dealershipName?: string;
  locationName?: string;
};

const aliases: Record<string, keyof TemplateVariables> = {
  customer: "customerName",
  customer_name: "customerName",
  customer_first_name: "customerName",
  first_name: "customerName",
  product: "productName",
  product_name: "productName",
  model: "productName",
  salesperson: "salespersonName",
  salesperson_name: "salespersonName",
  sales_rep_name: "salespersonName",
  sender_name: "salespersonName",
  dealership: "dealershipName",
  dealership_name: "dealershipName",
  company_name: "dealershipName",
  workspace_name: "dealershipName",
  location: "locationName",
  location_name: "locationName",
};

export function populateTemplateVariables(source: string, values: TemplateVariables) {
  return source.replace(/{{\s*([\w.-]+)\s*}}/g, (token, rawName: string) => {
    const key = aliases[rawName.toLowerCase().replace(/[.-]/g, "_")];
    const value = key ? values[key]?.trim() : "";
    return value || token;
  });
}

export function templateRelevance(template: MessageTemplate, context: string) {
  const words = new Set(context.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2));
  const haystack = `${template.title} ${template.category} ${template.tags.join(" ")}`.toLowerCase();
  let score = 0;
  for (const word of words) if (haystack.includes(word)) score += 1;
  return score;
}
