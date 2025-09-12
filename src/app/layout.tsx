import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/provider/AuthProvider";
import ClientLayout from "@/components/layout/ClientLayout";
import { SkipToContent } from "@/lib/accessibility.tsx";
import { NetworkStatusIndicator } from "@/components/common/NetworkStatusIndicator";
import { AnalyticsProvider } from "@/lib/providers/AnalyticsProvider";
// Sentry tracing meta propagation is handled automatically by the Sentry Next.js SDK in the App Router.

// Sentry tracing meta propagation is handled automatically by the Sentry Next.js SDK in the App Router.
// No need to manually inject sentry-trace meta tags.
export function generateMetadata(): Metadata {
  return {
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
    ),
  };
}

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DMDL Schools-In - Provider Check-In System",
  description:
    "Professional location-based check-in system for education service providers",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "DMDL Schools-In",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/DMDL_logo.png", sizes: "280x60", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

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
    <html lang="en" className="h-full">
      <body
        className={`${inter.className} h-full bg-background text-foreground antialiased`}
      >
        <SkipToContent />
        <AuthProvider>
          <AnalyticsProvider>
            <div className="min-h-full safe-area-inset">
              <ClientLayout>{children}</ClientLayout>
              <NetworkStatusIndicator />
            </div>
          </AnalyticsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
