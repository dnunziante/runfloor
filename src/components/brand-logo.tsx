import Image from "next/image";
import { brand } from "@/lib/brand";

type BrandLogoProps = {
  className?: string;
  compact?: boolean;
  priority?: boolean;
};

export function BrandLogo({ className, compact = false, priority = false }: BrandLogoProps) {
  const source = compact ? brand.markPath : brand.logoPath;
  const width = compact ? 44 : 300;
  const height = compact ? 44 : 90;

  return <Image className={className} src={source} alt={brand.name} width={width} height={height} priority={priority} />;
}
