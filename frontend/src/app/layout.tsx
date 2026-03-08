import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { TopNav } from "@/components/TopNav";
import { QueryProvider } from "@/components/QueryProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: "MacroLens — Macro Trading Dashboard",
  description: "3-layer macro analysis framework with Trading Navigator",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans`}>
        <QueryProvider>
          <div className="min-h-screen stars">
            <TopNav />
            <main className="mx-auto max-w-7xl px-6 pb-16 pt-6">
              {children}
            </main>
          </div>
        </QueryProvider>
      </body>
    </html>
  );
}
