import type { Metadata } from "next";
import "./globals.css";
import { OrganizationThemeProvider } from "@/components/layout/OrganizationThemeProvider";

export const metadata: Metadata = {
  title: "Document Appraisal AI",
  description:
    "AI-powered document intelligence and records management system.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <OrganizationThemeProvider>
          {children}
        </OrganizationThemeProvider>
      </body>
    </html>
  );
}

