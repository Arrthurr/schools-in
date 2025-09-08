"use client";

import { AuthProvider } from "@/components/provider/AuthProvider";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { useAuth } from "@/lib/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { logOut } from "@/lib/firebase/auth";
import { useRouter } from "next/navigation";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <Header />
          {children}
        </AuthProvider>
      </body>
    </html>
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
      <nav>
        {user && (
          <div className="flex items-center gap-4">
            <Link href="/profile">Profile</Link>
            <Button variant="outline" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        )}
      </nav>
    </header>
  );
}
