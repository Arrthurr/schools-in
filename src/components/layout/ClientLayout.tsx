"use client";

import { useAuth } from "@/lib/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { logOut } from "@/lib/firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PWAInstallPrompt } from "@/components/pwa/PWAInstallPrompt";
import { PWAUpdatePrompt } from "@/components/pwa/PWAUpdatePrompt";
import { PWAStatus } from "@/components/pwa/PWAStatus";

interface ClientLayoutProps {
  children: React.ReactNode;
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  return (
    <>
      <Header />
      <PWAUpdatePrompt />
      <main className="container mx-auto px-4">
        <PWAInstallPrompt />
        {children}
      </main>
    </>
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
    <header className="p-4 flex justify-between items-center border-b">
      <Link
        href="/"
        className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-600 bg-clip-text text-transparent"
      >
        Schools-In
      </Link>
      <nav className="flex items-center gap-4">
        {user && (
          <>
            <PWAStatus />
            <Link href="/profile">Profile</Link>
            <Button variant="outline" onClick={handleSignOut}>
              Sign Out
            </Button>
          </>
        )}
      </nav>
    </header>
  );
}
