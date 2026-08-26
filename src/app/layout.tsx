import type { Metadata } from "next";
import "./globals.css";
import "./brand.css";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: { default: brand.name, template: `%s | ${brand.name}` },
  description: brand.description,
  applicationName: brand.name,
  keywords: ["RunFloor", "sales enablement", "dealership sales", "AI sales coaching"],
  icons: {
    icon: [{ url: "/favicon.ico" }, { url: "/brand/favicon-16.png", sizes: "16x16", type: "image/png" }, { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" }, { url: "/brand/favicon-48.png", sizes: "48x48", type: "image/png" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: `${brand.name} | ${brand.tagline}`,
    description: brand.description,
    siteName: brand.name,
    images: ["/opengraph-image.png"],
  },
  twitter: { card: "summary_large_image", title: `${brand.name} | ${brand.tagline}`, description: brand.description },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
