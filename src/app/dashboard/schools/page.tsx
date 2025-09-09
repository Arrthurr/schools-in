"use client";

import { useState } from "react";
import { ProtectedRoute } from "../../../components/auth/ProtectedRoute";
import { SchoolList } from "../../../components/provider/SchoolList";
import { SchoolDetailView } from "../../../components/provider/SchoolDetailView";
import { School } from "../../../lib/services/schoolService";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { ArrowLeft, School as SchoolIcon, MapPin, List } from "lucide-react";

export default function SchoolsPage() {
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "detail">("list");

  // Handle school selection for check-in
  const handleSchoolSelect = (school: School) => {
    console.log("School selected for check-in:", school.name);
    // This would trigger check-in flow in a real implementation
  };

  // Handle viewing school details
  const handleSchoolDetail = (school: School) => {
    setSelectedSchool(school);
    setViewMode("detail");
  };

  // Handle back to list
  const handleBackToList = () => {
    setSelectedSchool(null);
    setViewMode("list");
  };

  // Handle check-in from detail view
  const handleCheckInFromDetail = (school: School) => {
    console.log("Check-in initiated from detail view:", school.name);
    // This would trigger the actual check-in process
  };

  return (
    <ProtectedRoute roles={["provider", "admin"]}>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => (window.location.href = "/dashboard")}
                className="hover:bg-gray-200"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
              <div className="h-6 w-px bg-gray-300" />
              <SchoolIcon className="h-6 w-6 text-brand-primary" />
              <h1 className="text-3xl font-bold text-gray-900">
                {viewMode === "detail" && selectedSchool
                  ? selectedSchool.name
                  : "My Schools"}
              </h1>
            </div>
            <p className="text-gray-600">
              {viewMode === "detail" && selectedSchool
                ? "Detailed information and check-in options"
                : "View and manage your assigned school locations"}
            </p>
          </div>

          {/* View Mode Toggle */}
          <div className="mb-6">
            <div className="flex items-center gap-2 text-sm text-gray-600">
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
                      <ul className="space-y-2 text-sm text-gray-600">
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
                      <p className="text-sm text-gray-600 mb-3">
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
                  className="bg-white rounded-lg shadow-sm border"
                />
              )
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
