import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: "AccessBD | Healthcare Spatial Intelligence",
  description: "A planning dashboard for understanding seasonal healthcare accessibility across Bangladesh.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "AccessBD | Healthcare Spatial Intelligence",
    description: "See where healthcare is hardest to reach across Bangladesh.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "AccessBD healthcare accessibility map" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
