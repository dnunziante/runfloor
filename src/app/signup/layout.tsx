import type { ReactNode } from "react";
import { PublicHeader } from "@/components/public-header";

export default function SignupLayout({ children }: { children: ReactNode }) {
  return <div className="rv-signup-shell"><PublicHeader sticky/>{children}</div>;
}
