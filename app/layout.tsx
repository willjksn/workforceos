import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";

import { COMPANY_NAME, COMPANY_POSITIONING, PRODUCT_IDENTITY, PRODUCT_NAME } from "@/lib/brand/identity";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-cormorant",
  display: "swap",
});

export const metadata: Metadata = {
  title: PRODUCT_IDENTITY,
  description: `${PRODUCT_NAME} is the internal operating platform for ${COMPANY_NAME}. ${COMPANY_POSITIONING}`,
  openGraph: {
    title: PRODUCT_IDENTITY,
    description: COMPANY_POSITIONING,
    siteName: PRODUCT_NAME,
  },
  twitter: {
    card: "summary",
    title: PRODUCT_IDENTITY,
    description: COMPANY_POSITIONING,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${cormorant.variable} h-full antialiased`}>
      <body className="min-h-full font-sans text-foreground">
        <ClerkProvider
          signInFallbackRedirectUrl="/app"
          signUpFallbackRedirectUrl="/app"
          appearance={{
            variables: {
              colorPrimary: "#0F2D4A",
              colorForeground: "#102A3A",
              colorBackground: "#FFFFFF",
              colorInput: "#FFFFFF",
              colorInputForeground: "#102A3A",
              borderRadius: "8px",
              fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
            },
          }}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
