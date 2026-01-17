import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/provider/AuthProvider";
import ClientLayout from "@/components/layout/ClientLayout";
import { ThemeProvider } from "@/components/ui/theme-provider";

import { NetworkStatusIndicator } from "@/components/common/NetworkStatusIndicator";

export function generateMetadata(): Metadata {
  return {
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
    ),
    title: "CampusAccess - Provider Check-In System",
    description:
      "Professional location-based check-in system for education service providers",
    manifest: "/manifest.json",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "CampusAccess",
    },
    // Include standard cross-platform PWA capability meta alongside Apple's
    other: {
      "mobile-web-app-capable": "yes",
    },
    icons: {
      icon: [
        { url: "/PROPEL-rocket-blue.png", sizes: "768x975", type: "image/png" },
      ],
      apple: [
        { url: "/PROPEL-rocket-blue.png", sizes: "768x975", type: "image/png" },
      ],
    },
  };
}

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5, // Allow zooming for accessibility
  userScalable: true, // Enable user scaling for accessibility
  themeColor: "#154690",
  viewportFit: "cover", // Support for safe area insets on notched devices
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body
      className={`${inter.className} h-full bg-background text-foreground antialiased`}
      suppressHydrationWarning
      >
      <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      >
          <AuthProvider>
            <div className="min-h-full safe-area-inset">
              <ClientLayout>{children}</ClientLayout>
              <NetworkStatusIndicator />
            </div>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
