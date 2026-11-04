import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/viewer";
import { canViewExecutive } from "@/lib/auth/permissions";
export default async function ManagementLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer?.organizationId) redirect("/login");
  if (!canViewExecutive(viewer.role)) redirect("/dashboard");
  return children;
}
