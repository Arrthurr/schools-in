"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { signOut } from "firebase/auth";
import { auth } from "../../../../firebase.config";
import { useCachedAuth } from "@/lib/hooks/useCachedAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { FeedbackForm } from "@/components/feedback/FeedbackForm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Logo } from "@/components/ui/logo";
import {
  Menu,
  Home,
  History,
  User,
  MessageSquare,
  LogOut,
  Bell,
  School,
} from "lucide-react";

export default function FeedbackPage() {
  const { user } = useCachedAuth();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const navigationItems = [
    { name: "Dashboard", href: "/dashboard", icon: Home },
    {
      name: "Session History",
      href: "/dashboard/history",
      icon: History,
    },
    {
      name: "My Schools",
      href: "/dashboard/schools",
      icon: School,
    },
    {
      name: "Feedback",
      href: "/provider/feedback",
      icon: MessageSquare,
    },
  ].map((item) => ({
    ...item,
    current: pathname === item.href,
  }));

  return (
    <ProtectedRoute roles={["provider", "admin"]}>
      <div className="min-h-screen bg-background">
        {/* Desktop Sidebar */}
        <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:bg-card lg:border-r lg:shadow-lg">
          <div className="flex h-full flex-col">
            <div className="flex h-16 shrink-0 items-center px-4 border-b">
              <Logo size="sm" priority />
            </div>

            <div className="p-4 border-b">
              <div className="flex items-center">
                <div className="h-10 w-10 rounded-full bg-brand-primary flex items-center justify-center">
                  <User className="h-6 w-6 text-white" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-foreground">
                    {user?.displayName || user?.email || "Provider User"}
                  </p>
                  <Badge variant="secondary" className="text-xs mt-1">
                    {user?.role || "Provider"}
                  </Badge>
                </div>
              </div>
            </div>

            <nav className="flex-1 space-y-1 px-2 py-4">
              {navigationItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href as any}
                  className={`group flex items-center w-full px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                    item.current
                      ? "bg-brand-primary text-white"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  <item.icon
                    className={`mr-3 h-5 w-5 ${
                      item.current
                        ? "text-white"
                        : "text-muted-foreground group-hover:text-foreground"
                    }`}
                  />
                  {item.name}
                </Link>
              ))}
            </nav>

            <div className="p-4 border-t">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleSignOut}
              >
                <LogOut className="mr-3 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent side="left" className="w-64 p-0">
            <div className="flex h-full flex-col">
              <div className="flex h-16 shrink-0 items-center px-4 border-b">
                <Logo size="sm" priority />
              </div>

              <div className="p-4 border-b">
                <div className="flex items-center">
                  <div className="h-10 w-10 rounded-full bg-brand-primary flex items-center justify-center">
                    <User className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-foreground">
                      {user?.displayName || user?.email || "Provider User"}
                    </p>
                    <Badge variant="secondary" className="text-xs mt-1">
                      {user?.role || "Provider"}
                    </Badge>
                  </div>
                </div>
              </div>

              <nav className="flex-1 space-y-1 px-2 py-4">
                {navigationItems.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href as any}
                    className={`group flex items-center w-full px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                      item.current
                        ? "bg-brand-primary text-white"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    }`}
                    onClick={() => setMobileNavOpen(false)}
                  >
                    <item.icon
                      className={`mr-3 h-5 w-5 ${
                        item.current
                          ? "text-white"
                          : "text-muted-foreground group-hover:text-foreground"
                      }`}
                    />
                    {item.name}
                  </Link>
                ))}
              </nav>

              <div className="p-4 border-t">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handleSignOut}
                >
                  <LogOut className="mr-3 h-4 w-4" />
                  Sign Out
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <div className="lg:pl-64">
          <div className="sticky top-0 z-40 bg-card shadow-sm border-b">
            <div className="flex h-16 items-center gap-x-4 px-4 sm:gap-x-6 sm:px-6">
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open sidebar"
              >
                <Menu className="h-5 w-5" />
              </Button>

              <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
                <div className="flex flex-1 items-center">
                  <h1 className="text-xl font-semibold text-foreground">
                    Help & Feedback
                  </h1>
                </div>
                <div className="flex items-center gap-x-4 lg:gap-x-6">
                  <Button variant="ghost" size="sm" aria-label="Notifications">
                    <Bell className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <main className="py-6">
            <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
              <div className="mb-8">
                <p className="text-muted-foreground">
                  We value your input. Please let us know if you encounter any
                  issues or have suggestions for improvement.
                </p>
              </div>

              <FeedbackForm />
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
