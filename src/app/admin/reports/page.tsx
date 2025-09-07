// Reports and export page

import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reports & Export | Schools In Admin',
  description: 'Generate reports and export session data',
};

export default function ReportsPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Reports & Export</h1>
        </div>
        
        {/* Report Filters */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Report Filters</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date Range
              </label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Provider
              </label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">All Providers</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                School
              </label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">All Schools</option>
              </select>
            </div>
            
            <div className="flex items-end">
              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                Generate Report
              </button>
            </div>
          </div>
        </div>
        
        {/* Report Summary */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Total Sessions</h3>
            <p className="text-2xl font-bold">--</p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Total Duration</h3>
            <p className="text-2xl font-bold">--</p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Average Session</h3>
            <p className="text-2xl font-bold">--</p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Completion Rate</h3>
            <p className="text-2xl font-bold">--</p>
          </div>
        </div>
        
        {/* Export Options */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Export Data</h2>
          <div className="flex flex-wrap gap-4">
            <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg">
              Export to CSV
            </button>
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
              Export to Excel
            </button>
            <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg">
              Export to PDF
            </button>
          </div>
        </div>
        
        {/* Report Data Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Session Data</h2>
          </div>
          <div className="p-6">
            <p className="text-gray-600">
              Session data table will be implemented here
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
