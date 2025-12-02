"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, User, X } from "lucide-react";
import { SkeletonList } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-empty-states";
import { useActiveSessions } from "@/lib/hooks/useActiveSessions";

interface ActiveSessionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ActiveSessionsModal({
  isOpen,
  onClose,
}: ActiveSessionsModalProps) {
  const { activeSessions, loading, error } = useActiveSessions();
  const [searchTerm, setSearchTerm] = useState("");

  // Filter sessions based on search term
  const filteredSessions = activeSessions.filter((session) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      session.providerName.toLowerCase().includes(searchLower) ||
      session.schoolName.toLowerCase().includes(searchLower) ||
      session.elapsedTime.toLowerCase().includes(searchLower)
    );
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Active Sessions</DialogTitle>
        </DialogHeader>

        {error && (
          <ErrorState
            type="generic"
            title="Failed to load active sessions"
            message={error}
            onAction={() => window.location.reload()}
            actionLabel="Retry"
            className="max-w-md mx-auto mt-4"
          />
        )}

        {!error && (
          <>
            {/* Search and Session Count */}
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="relative flex-1">
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                    <Search className="h-4 w-4" />
                  </div>
                  <input
                    placeholder="Search sessions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  />
                </div>
                <Badge variant="secondary" className="text-sm">
                  {filteredSessions.length} active session
                  {filteredSessions.length !== 1 ? "s" : ""}
                </Badge>
              </div>
            </div>

            {/* Session List */}
            <div className="mt-4 space-y-3">
              {loading ? (
                <SkeletonList items={3} />
              ) : filteredSessions.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No active sessions found</p>
                </div>
              ) : (
                filteredSessions.map((session) => (
                  <div
                    key={session.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        <Badge
                          variant="default"
                          className="bg-brand-primary text-white"
                        >
                          <Clock className="h-4 w-4 mr-1" />
                          {session.elapsedTime}
                        </Badge>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <User className="h-4 w-4 text-gray-500" />
                          <h3 className="font-medium text-gray-900 truncate">
                            {session.providerName}
                          </h3>
                          <Badge variant="secondary" className="text-xs">
                            {session.status}
                          </Badge>
                        </div>

                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <span className="truncate">{session.schoolName}</span>
                        </div>

                        <div className="text-xs text-gray-500 mt-1">
                          Session ID: {session.id}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Search icon component (since it's not imported from lucide-react)
function Search({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}
