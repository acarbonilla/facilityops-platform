import type { Metadata } from "next";
import { Manrope, Source_Sans_3 } from "next/font/google";

import { AppProviders } from "@/components/providers/app-providers";

import "./globals.css";

const displayFont = Manrope({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const bodyFont = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "FacilityOps Platform",
    template: "%s | FacilityOps",
  },
  description: "Enterprise facility operations management platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body className="min-h-screen bg-slate-50 font-sans text-slate-950 antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
