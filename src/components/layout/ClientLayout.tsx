"use client";

import { useAuth } from "@/lib/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { logOut } from "@/lib/firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PWAInstallPrompt } from "@/components/pwa/PWAInstallPrompt";
import { PWAUpdatePrompt } from "@/components/pwa/PWAUpdatePrompt";
import { PWAStatus } from "@/components/pwa/PWAStatus";
import { OfflineMessagingProvider } from "@/components/offline/OfflineMessaging";
import { OfflineStatusBar } from "@/components/offline/OfflineStatusBar";
import { OfflineStatusIndicator } from "@/components/offline/OfflineStatusIndicator";
import { Toaster } from "@/components/ui/toaster";
import { Logo } from "../ui/logo";
import AnalyticsProvider from "@/components/analytics/AnalyticsProvider";

interface ClientLayoutProps {
  children: React.ReactNode;
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  return (
    <OfflineMessagingProvider enableToasts={true} enableNotifications={true}>
      <div className="flex flex-col min-h-screen">
  <AnalyticsProvider />
        <Header />
        <OfflineStatusBar variant="compact" position="top" />
        <PWAUpdatePrompt />
        <main
          id="main-content"
          className="flex-1 container-responsive py-4 sm:py-6 lg:py-8"
          tabIndex={-1}
        >
          <PWAInstallPrompt />
          {children}
        </main>
        <Toaster />
      </div>
    </OfflineMessagingProvider>
  );
}

function Header() {
  const { user } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await logOut();
    router.push("/");
  };

  return (
    <header
      className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b"
      role="banner"
    >
      <div className="container-responsive py-3 sm:py-4">
        <div className="flex justify-between items-center">
          <Link href="/" className="focus-ring" aria-label="Schools-In Home">
            <Logo size="sm" priority />
          </Link>
          <nav
            className="flex items-center gap-2 sm:gap-4"
            role="navigation"
            aria-label="Main navigation"
          >
            {user && (
              <>
                <OfflineStatusIndicator
                  variant="compact"
                  className="hidden sm:flex"
                />
                <div className="hidden md:flex">
                  <PWAStatus />
                </div>
                <Link
                  href="/profile"
                  className="touch-target text-sm sm:text-base text-foreground/80 hover:text-foreground transition-colors focus-ring"
                  aria-label="User profile"
                >
                  Profile
                </Link>
                <Button
                  variant="outline"
                  onClick={handleSignOut}
                  className="touch-target text-sm sm:text-base focus-ring"
                  size="sm"
                  aria-label="Sign out of application"
                >
                  <span className="hidden sm:inline">Sign Out</span>
                  <span className="sm:hidden">Out</span>
                </Button>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
