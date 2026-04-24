import type { Metadata, Viewport } from "next";
import {
  Big_Shoulders_Stencil,
  Fraunces,
  DM_Sans,
  Caveat,
} from "next/font/google";
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

export const metadata: Metadata = {
  title: "QUIC Festival 2026 · RSVP",
  description:
    "Confirma a tua presença no QUIC Festival 2026 · 8 e 9 de Maio · Monsanto Open Air, Lisboa.",
};

export const viewport: Viewport = {
  themeColor: "#06182A",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-PT"
      className={`${stencil.variable} ${fraunces.variable} ${dmSans.variable} ${caveat.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
