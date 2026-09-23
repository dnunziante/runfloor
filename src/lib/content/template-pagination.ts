export const TEMPLATE_PAGE_SIZE = 100;

export type ManagedContentType = "sales_script" | "objection_response" | "email_template" | "text_template";

export type TemplateFilters = {
  contentType: ManagedContentType;
  category: string;
  tag: string;
  status: string;
  sort: string;
  query: string;
  page: number;
};

export type TemplateRow = { id: string; title: string; objection: string; body: string; status: "draft" | "published" | "archived"; category: string; tags: string[]; updatedAt: string };
export type TemplatePage = { rows: TemplateRow[]; total: number; page: number; error: string };
