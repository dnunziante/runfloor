import { redirect } from "next/navigation";
import { ENABLE_SALES_COACHING } from "@/lib/features";
export default function CoachingAccessLayout({ children }: { children: React.ReactNode }) {
  if (!ENABLE_SALES_COACHING) redirect("/dashboard");
  return children;
}
