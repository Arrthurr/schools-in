import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

// Admin dashboard page

import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Dashboard | Schools In",
  description: "Admin dashboard for school and provider management",
};

export default function AdminDashboardPage() {
  return (
    <ProtectedRoute roles={["admin"]}>
      <div className="container mx-auto py-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* Overview Stats */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">
                Total Schools
              </h3>
              <p className="text-2xl font-bold">--</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">
                Active Providers
              </h3>
              <p className="text-2xl font-bold">--</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">
                Active Sessions
              </h3>
              <p className="text-2xl font-bold">--</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">
                Today's Check-ins
              </h3>
              <p className="text-2xl font-bold">--</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Recent Activity */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
              <p className="text-gray-600">
                Activity feed will be implemented here
              </p>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
              <div className="space-y-3">
                <button className="w-full text-left p-3 rounded-lg bg-gray-50 hover:bg-gray-100">
                  Manage Schools
                </button>
                <button className="w-full text-left p-3 rounded-lg bg-gray-50 hover:bg-gray-100">
                  View Reports
                </button>
                <button className="w-full text-left p-3 rounded-lg bg-gray-50 hover:bg-gray-100">
                  Manage Users
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
