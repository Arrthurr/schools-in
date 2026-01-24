"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { signOut } from "firebase/auth";
import { auth } from "../../../../firebase.config";
import { useCachedAuth } from "@/lib/hooks/useCachedAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { SchoolList } from "@/components/provider/SchoolList";
import { SchoolDetailView } from "@/components/provider/SchoolDetailView";
import { Location } from "@/lib/firebase/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import {
  Menu,
  Home,
  History,
  User,
  MessageSquare,
  LogOut,
  Bell,
  School as SchoolIcon,
  MapPin,
  List,
} from "lucide-react";
import { appLogger } from "@/lib/logging/appLogger";

export default function SchoolsPage() {
  const { user } = useCachedAuth();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<Location | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "detail">("list");

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
      icon: SchoolIcon,
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

  // Handle school selection for check-in
  const handleSchoolSelect = (school: Location) => {
    appLogger.info("School selected for check-in", { school: school.name });
  };

  // Handle viewing school details
  const handleSchoolDetail = (school: Location) => {
    setSelectedSchool(school);
    setViewMode("detail");
  };

  // Handle back to list
  const handleBackToList = () => {
    setSelectedSchool(null);
    setViewMode("list");
  };

  // Handle check-in from detail view
  const handleCheckInFromDetail = (school: Location) => {
    appLogger.info("Check-in initiated from detail view", {
      school: school.name,
    });
  };

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
                <div className="flex flex-1 items-center gap-3">
                  <SchoolIcon className="h-6 w-6 text-brand-primary" />
                  <h1 className="text-xl font-semibold text-foreground">
                    {viewMode === "detail" && selectedSchool
                      ? selectedSchool.name
                      : "My Schools"}
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
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              {/* View Mode Info */}
              <div className="mb-6">
                <p className="text-muted-foreground">
                  {viewMode === "detail" && selectedSchool
                    ? "Detailed information and check-in options"
                    : "View and manage your assigned school locations"}
                </p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                  <MapPin className="h-4 w-4" />
                  <span>
                    {viewMode === "list"
                      ? "Select a school to view details or check in"
                      : "Viewing detailed school information"}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="space-y-6">
                {viewMode === "list" ? (
                  /* School List View */
                  <div className="grid gap-6 lg:grid-cols-1">
                    <SchoolList
                      onSchoolSelect={handleSchoolSelect}
                      onSchoolDetail={handleSchoolDetail}
                      showCheckInButtons={true}
                      showDetailButtons={true}
                      className="lg:col-span-1"
                    />

                    {/* Additional Information Cards */}
                    <div className="grid gap-6 lg:grid-cols-3">
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg flex items-center">
                            <List className="h-5 w-5 mr-2 text-brand-primary" />
                            Quick Tips
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2 text-sm text-muted-foreground">
                            <li className="flex items-start gap-2">
                              <div className="w-1.5 h-1.5 bg-brand-primary rounded-full mt-2 flex-shrink-0" />
                              Click "View Details" to see comprehensive school
                              information
                            </li>
                            <li className="flex items-start gap-2">
                              <div className="w-1.5 h-1.5 bg-brand-primary rounded-full mt-2 flex-shrink-0" />
                              Enable location services for accurate distance
                              calculations
                            </li>
                            <li className="flex items-start gap-2">
                              <div className="w-1.5 h-1.5 bg-brand-primary rounded-full mt-2 flex-shrink-0" />
                              You must be within the check-in radius to start a
                              session
                            </li>
                          </ul>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg flex items-center">
                            <MapPin className="h-5 w-5 mr-2 text-brand-primary" />
                            Location Status
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-green-500 rounded-full" />
                              <span className="text-sm">
                                In Range - Ready to check in
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                              <span className="text-sm">
                                Out of Range - Move closer
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-gray-400 rounded-full" />
                              <span className="text-sm">
                                Location Unknown - Enable GPS
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg">Need Help?</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-3">
                            Having trouble with school locations or check-in?
                          </p>
                          <Button size="sm" variant="outline" className="w-full">
                            Contact Support
                          </Button>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                ) : (
                  /* School Detail View */
                  selectedSchool && (
                    <SchoolDetailView
                      school={selectedSchool}
                      onBack={handleBackToList}
                      onCheckIn={handleCheckInFromDetail}
                      showCheckInButton={true}
                      className="bg-card rounded-lg shadow-sm border"
                    />
                  )
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
