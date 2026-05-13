import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Inter } from "next/font/google";
import "./globals.css";
import { AppFrame } from "@/components/AppFrame";
import { QueryProvider } from "@/components/QueryProvider";
import { NextShellThemeProvider } from "@/components/next-dashboard/nextShellTheme";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["300", "400", "500", "600"],
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-plex-sans",
  weight: ["300", "400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "MacroLens — Macro Trading Dashboard",
  description: "3-layer macro analysis framework with Trading Navigator",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${plexSans.variable} ${plexMono.variable} font-sans`}>
        <QueryProvider>
          <NextShellThemeProvider>
            <AppFrame>{children}</AppFrame>
          </NextShellThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
