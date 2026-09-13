import { MessageGenerator } from "@/components/message-generator";
import { RvMessageStudio } from "@/components/rv-message-studio";
import { getViewer } from "@/lib/auth/viewer";
import { getViewerIndustryTemplateKey } from "@/lib/organizations/industry";
import { getTenantProducts } from "@/lib/products/data";

export default async function Email() {
  const viewer = await getViewer();
  const result = await getTenantProducts();
  const products = result.products.map((product) => `${product.name}${product.model ? ` — ${product.model}` : ""}`);
  if (viewer && await getViewerIndustryTemplateKey(viewer) === "rv") return <RvMessageStudio initialKind="email" productOptions={products}/>;
  return <MessageGenerator kind="email" productOptions={products}/>;
}
