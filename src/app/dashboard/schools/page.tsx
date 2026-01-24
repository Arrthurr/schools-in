"use client";

import { useState } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ProviderNavigation } from "@/components/provider/ProviderNavigation";
import { SchoolList } from "@/components/provider/SchoolList";
import { SchoolDetailView } from "@/components/provider/SchoolDetailView";
import { Location } from "@/lib/firebase/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MapPin, List } from "lucide-react";
import { appLogger } from "@/lib/logging/appLogger";

export default function SchoolsPage() {
  const [selectedSchool, setSelectedSchool] = useState<Location | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "detail">("list");

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
      <ProviderNavigation>
        <div className="mx-auto max-w-7xl">
          {/* View Mode Info */}
          <div className="mb-6">
            <h1 className="text-2xl font-semibold mb-2">
              {viewMode === "detail" && selectedSchool
                ? selectedSchool.name
                : "My Schools"}
            </h1>
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
      </ProviderNavigation>
    </ProtectedRoute>
  );
}
