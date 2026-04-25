import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import {
  Big_Shoulders_Stencil,
  Fraunces,
  DM_Sans,
  Caveat,
} from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const stencil = Big_Shoulders_Stencil({
  variable: "--font-stencil",
  subsets: ["latin"],
  weight: ["500", "700", "900"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500", "700", "900"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://quic-festival.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "QUIC Festival 2026 · RSVP",
  description:
    "Confirma a tua presença no QUIC Festival 2026 · 8 e 9 de Maio · Monsanto Open Air, Lisboa.",
  applicationName: "QUIC Festival",
  keywords: [
    "QUIC Festival",
    "festival lisboa",
    "monsanto open air",
    "rsvp",
    "8 maio",
    "9 maio",
    "2026",
  ],
  authors: [{ name: "QUIC" }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_PT",
    url: "/",
    siteName: "QUIC Festival 2026",
    title: "QUIC Festival 2026 · 8 e 9 de Maio",
    description:
      "Monsanto Open Air, Lisboa. Confirma a tua presença e recebe o QR de entrada.",
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 630,
        alt: "QUIC Festival 2026",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "QUIC Festival 2026",
    description:
      "8 e 9 de Maio · Monsanto Open Air, Lisboa. Confirma a tua presença.",
    images: ["/logo.png"],
  },
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#06182A",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="pt-PT"
      className={`${stencil.variable} ${fraunces.variable} ${dmSans.variable} ${caveat.variable} h-full antialiased`}
    >
      <head>
        {nonce && <meta name="csp-nonce" content={nonce} />}
      </head>
      <body className="min-h-full">
        {children}
        {/* Analytics aceita nonce via prop em prod (suporte oficial). */}
        <Analytics />
      </body>
    </html>
  );
}
