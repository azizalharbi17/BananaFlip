import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { getCoins } from "@/lib/coins";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "BananaFlip — market cap flip calculator",
    template: "%s — BananaFlip",
  },
  description:
    "Can it flip? Pick two coins — BananaFlip shows Coin A's price at Coin B's market cap, and how many ×'s away the flip is.",
  openGraph: {
    siteName: "BananaFlip",
    type: "website",
  },
  twitter: {
    card: "summary",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { isDemoData } = await getCoins();
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <Nav isDemoData={isDemoData} />
        {children}
        <Footer isDemoData={isDemoData} />
      </body>
    </html>
  );
}
