import Link from "next/link";
import type { ComponentProps } from "react";
import { isFeatureDestinationEnabled } from "@/lib/features";

// Applies the same feature policy to static links and repository-provided
// priority/readiness links without changing their source records or scores.
export function FeatureLink(props: ComponentProps<typeof Link>) {
  const path = typeof props.href === "string" ? props.href : props.href.pathname ?? "";
  if (!isFeatureDestinationEnabled(path)) return null;
  return <Link {...props}/>;
}
