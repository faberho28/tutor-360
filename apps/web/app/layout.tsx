import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "PC-Tutor 360",
  description: "Una cámara, una página, y la PC se explica sola.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={inter.variable} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <TooltipProvider>{children}</TooltipProvider>
          {/* On small screens the scanner's drawer peeks 96px at the bottom. */}
          <Toaster position="bottom-right" mobileOffset={{ bottom: 112 }} />
        </ThemeProvider>
      </body>
    </html>
  );
}
