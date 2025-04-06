import type { Metadata } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import React from "react";
import "./globals.css";

/**
 * Font configuration for Inter font
 * Used as the primary font for the application
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

/**
 * Font configuration for Roboto Mono font
 * Used for code and monospaced text in the application
 */
const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
});

/**
 * Metadata for the application
 * Used by Next.js for SEO and document head configuration
 */
export const metadata: Metadata = {
  title: "DuckDB Database File Viewer",
  description: "A tool for visualizing the internal structure of DuckDB database files",
};

/**
 * Props for the RootLayout component
 */
interface RootLayoutProps {
  /** React children to be rendered within the layout */
  children: React.ReactNode;
}

/**
 * RootLayout component that wraps all pages in the application
 * Provides the basic HTML structure and global styling
 *
 * @param props - Component properties
 * @returns Root layout structure with children
 */
export default function RootLayout({ children }: Readonly<RootLayoutProps>): React.ReactElement {
  return (
    <html lang="en" className={`${inter.variable} ${robotoMono.variable}`}>
      <body
        className="antialiased min-h-screen bg-[var(--background)] text-[var(--foreground)]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </div>
      </body>
    </html>
  );
}
