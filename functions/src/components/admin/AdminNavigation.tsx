"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  LayoutDashboard,
  School,
  FileText,
  Users,
  Settings,
  Menu,
  LogOut,
  Bell,
  ChevronDown,
  Activity,
} from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import { logOut } from "@/lib/firebase/auth";
import { useRouter } from "next/navigation";
import { Logo } from "../ui/logo";

interface AdminNavigationProps {
  children: React.ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  description?: string;
}

const navigationItems: NavItem[] = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: LayoutDashboard,
    description: "Overview and statistics",
  },
  {
    href: "/admin/schools",
    label: "Schools",
    icon: School,
    description: "Manage school locations",
  },
  {
    href: "/admin/reports",
    label: "Reports",
    icon: FileText,
    description: "Session reports and exports",
  },
  {
    href: "/admin/users",
    label: "Users",
    icon: Users,
    description: "Manage providers and admins",
  },
  {
    href: "/admin/assignments",
    label: "Assignments",
    icon: Activity,
    description: "School-provider assignments",
  },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: Settings,
    description: "System configuration",
  },
];

export function AdminNavigation({ children }: AdminNavigationProps) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleSignOut = async () => {
    await logOut();
    router.push("/");
  };

  const isActiveRoute = (href: string) => {
    if (href === "/admin") {
      return pathname === "/admin";
    }
    return pathname.startsWith(href);
  };

  const NavigationContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo/Brand */}
      <div className="flex items-center px-6 py-4 border-b">
        <Link href="/admin" className="flex items-center space-x-2">
          <Logo size="sm" showText={false} priority />
          <div>
            <h2 className="text-lg font-semibold">Schools In</h2>
            <p className="text-xs text-muted-foreground">Admin Panel</p>
          </div>
        </Link>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = isActiveRoute(item.href);

          return (
            <Link
              key={item.href}
              href={item.href as any}
              className={`
                flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors
                ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }
              `}
              onClick={() => setMobileNavOpen(false)}
            >
              <Icon className="h-4 w-4 mr-3" />
              {item.label}
              {item.badge && (
                <Badge variant="secondary" className="ml-auto">
                  {item.badge}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="px-3 py-4 border-t">
        <div className="flex items-center px-3 py-2 rounded-lg bg-muted">
          <div className="flex-1">
            <p className="text-sm font-medium">
              {user?.displayName || user?.email}
            </p>
            <p className="text-xs text-muted-foreground">Administrator</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="h-8 w-8 p-0"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:bg-card lg:border-r">
        <NavigationContent />
      </div>

      {/* Mobile Navigation */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden fixed top-4 left-4 z-40"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <NavigationContent />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Top Header */}
        <header className="bg-card border-b px-4 py-3 lg:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden"
                onClick={() => setMobileNavOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>

              {/* Breadcrumb */}
              <div className="hidden sm:flex items-center space-x-2 text-sm text-muted-foreground">
                <Link href="/admin" className="hover:text-foreground">
                  Admin
                </Link>
                {pathname !== "/admin" && (
                  <>
                    <span>/</span>
                    <span className="text-foreground">
                      {navigationItems.find(
                        (item) =>
                          pathname.startsWith(item.href) &&
                          item.href !== "/admin"
                      )?.label || "Page"}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm">
                <Bell className="h-4 w-4" />
              </Button>
              <div className="hidden sm:flex items-center space-x-2 pl-2 border-l">
                <div className="text-right">
                  <p className="text-sm font-medium">
                    {user?.displayName || user?.email}
                  </p>
                  <p className="text-xs text-muted-foreground">Administrator</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
