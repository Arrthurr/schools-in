// School management page

import { Metadata } from 'next';
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminNavigation } from "@/components/admin/AdminNavigation";

export const metadata: Metadata = {
  title: 'School Management | Schools In Admin',
  description: 'Manage schools and locations for provider check-in/check-out',
};

export default function SchoolManagementPage() {
  return (
    <ProtectedRoute roles={["admin"]}>
      <AdminNavigation>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">School Management</h1>
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
              Add New School
            </button>
          </div>
        
        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search schools..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
        
        {/* Schools Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Schools</h2>
          </div>
          <div className="p-6">
            <p className="text-gray-600">
              School management table will be implemented here
            </p>
          </div>
        </div>
        </div>
      </AdminNavigation>
    </ProtectedRoute>
  );
}
