import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

// Provider dashboard page

import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Provider Dashboard | Schools In",
  description: "Provider dashboard for check-in and check-out management",
};

export default function DashboardPage() {
  return (
    <ProtectedRoute roles={["provider", "admin"]}>
      <div className="container mx-auto py-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Provider Dashboard</h1>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Current Status Card */}
            <div className="col-span-full bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Current Status</h2>
              <p className="text-gray-600">
                Check-in/out functionality will be implemented here
              </p>
            </div>

            {/* Assigned Schools */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Assigned Schools</h2>
              <p className="text-gray-600">
                School list component will be implemented here
              </p>
            </div>

            {/* Recent Sessions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Recent Sessions</h2>
              <p className="text-gray-600">
                Session history component will be implemented here
              </p>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
              <p className="text-gray-600">
                Check-in/out buttons will be implemented here
              </p>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
