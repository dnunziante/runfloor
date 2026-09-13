import { MessageGenerator } from "@/components/message-generator";
import { RvMessageStudio } from "@/components/rv-message-studio";
import { getViewer } from "@/lib/auth/viewer";
import { getViewerIndustryTemplateKey } from "@/lib/organizations/industry";
import { getTenantProducts } from "@/lib/products/data";

export default async function Text() {
  const viewer = await getViewer();
  const result = await getTenantProducts();
  const products = result.products.map((product) => `${product.name}${product.model ? ` — ${product.model}` : ""}`);
  if (viewer && await getViewerIndustryTemplateKey(viewer) === "rv") return <RvMessageStudio initialKind="text" productOptions={products}/>;
  return <MessageGenerator kind="text" productOptions={products}/>;
}
