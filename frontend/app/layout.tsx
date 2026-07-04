import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FacilityOps Platform",
  description: "Enterprise facility operations management platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-950 antialiased">
        {children}
      </body>
    </html>
  );
}
