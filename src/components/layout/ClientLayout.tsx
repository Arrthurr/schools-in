"use client";

import { useAuth } from "@/lib/hooks/useAuth";
import { useStartupLogging } from "@/lib/hooks/useStartupLogging";
import { appLogger } from "@/lib/logging/appLogger";

import { Button } from "@/components/ui/button";
import { logOut } from "@/lib/firebase/auth";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { PWAInstallPrompt } from "@/components/pwa/PWAInstallPrompt";
import { PWAUpdatePrompt } from "@/components/pwa/PWAUpdatePrompt";
import { PWAStatus } from "@/components/pwa/PWAStatus";
import { OfflineMessagingProvider } from "@/components/offline/OfflineMessaging";
import { OfflineStatusBar } from "@/components/offline/OfflineStatusBar";
import { OfflineStatusIndicator } from "@/components/offline/OfflineStatusIndicator";
import { Toaster } from "@/components/ui/toaster";
import { Logo } from "../ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useState, useEffect } from "react";

interface ClientLayoutProps {
  children: React.ReactNode;
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  useStartupLogging();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  
  // Ensure consistent rendering between server and client
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Use consistent initial className to prevent hydration mismatch
  // Default to non-admin styling to prevent layout shift
  const isAdminRoute = mounted && pathname?.startsWith("/admin");
  const mainClassName = isAdminRoute
    ? "flex-1" // Remove container constraints for admin dashboard
    : "flex-1 container-responsive py-4 sm:py-6 lg:py-8";

  return (
    <OfflineMessagingProvider enableToasts={true} enableNotifications={true}>
      <div className="flex flex-col min-h-screen">
        {mounted && !isAdminRoute && <Header />}
        {mounted && <OfflineStatusBar variant="compact" position="top" />}
        {mounted && <PWAUpdatePrompt />}
        <main
          id="main-content"
          className={mainClassName}
          tabIndex={-1}
        >
          {mounted && <PWAInstallPrompt />}
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
    try {
      await logOut();
      router.push("/");
    } catch (error) {
      appLogger.error("Sign out failed", { error });
    }
  };

  return (
    <header
      className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b"
      role="banner"
    >
      <div className="container-responsive py-3 sm:py-4">
        <div className="flex justify-between items-center">
          <Link href="/" className="focus-ring" aria-label="CampusAccess Home">
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
                <ThemeToggle />
                <Button
                  variant="outline"
                  onClick={handleSignOut}
                  className="touch-target text-sm focus-ring whitespace-nowrap"
                  size="sm"
                  aria-label="Sign out of application"
                >
                  Sign Out
                </Button>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}