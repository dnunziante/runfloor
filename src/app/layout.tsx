import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "RunFloor", template: "%s | RunFloor" },
  description: "The AI-powered sales platform for dealerships.",
  applicationName: "RunFloor",
  icons: { icon: "/icon.png", apple: "/icon.png" },
  openGraph: {
    title: "RunFloor",
    description: "Run your sales floor.",
    images: ["/opengraph-image.png"],
  },
  twitter: { card: "summary_large_image", title: "RunFloor", description: "Run your sales floor." },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
