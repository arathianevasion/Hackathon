import type { Metadata } from "next";
import { Inter, Lato } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

// The Integrity design system: Lato for text, Inter for data. globals.css reads these variables.
const lato = Lato({ subsets: ["latin"], weight: ["400", "700", "900"], variable: "--font-lato", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Integrity Client Advocate",
  description: "Synthetic data only",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${lato.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
