"use client";

import { PWAInstallPrompt } from "./PWAInstallPrompt";
import { PWAUpdatePrompt } from "./PWAUpdatePrompt";
import { PWAStatus } from "./PWAStatus";
import { OfflineNotification } from "./OfflineQueue";

interface PWALayoutProps {
  children: React.ReactNode;
  showStatus?: boolean;
  showOfflineNotification?: boolean;
}

export function PWALayout({
  children,
  showStatus = true,
  showOfflineNotification = true,
}: PWALayoutProps) {
  return (
    <div className="min-h-screen">
      {/* PWA Status Bar */}
      {showStatus && (
        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="container mx-auto px-4 py-2">
            <PWAStatus />
          </div>
        </div>
      )}

      {/* Offline Notification */}
      {showOfflineNotification && (
        <div className="sticky top-16 z-40 p-4">
          <OfflineNotification />
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* PWA Install Prompt */}
      <PWAInstallPrompt />

      {/* PWA Update Prompt */}
      <PWAUpdatePrompt />
    </div>
  );
}
