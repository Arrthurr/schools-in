import * as React from "react";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Clock,
  MapPin,
  Calendar,
  CheckCircle,
  AlertCircle,
  User,
  FileText,
  X,
} from "lucide-react";
import { SessionData } from "@/lib/utils/session";
import {
  formatSessionTime,
  formatDuration,
  formatDurationDetailed,
  calculateSessionDuration,
} from "@/lib/utils/session";

interface SessionDetailModalProps {
  session: SessionData | null;
  schoolName?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const SessionDetailModal: React.FC<SessionDetailModalProps> = ({
  session,
  schoolName,
  isOpen,
  onClose,
}) => {
  const [realTimeDuration, setRealTimeDuration] = useState<number | null>(null);

  // Update real-time duration for active sessions
  useEffect(() => {
    if (!session || session.status !== "active" || !session.checkInTime) {
      setRealTimeDuration(null);
      return;
    }

    const updateDuration = () => {
      const now = new Date();
      const checkInTime = session.checkInTime.toDate();
      const duration = Math.floor(
        (now.getTime() - checkInTime.getTime()) / (1000 * 60)
      );
      setRealTimeDuration(duration);
    };

    // Update immediately
    updateDuration();

    // Update every minute
    const interval = setInterval(updateDuration, 60000);

    return () => clearInterval(interval);
  }, [session]);

  if (!session) return null;

  const formatCoordinates = (lat: number, lng: number) => {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                Session Details
              </DialogTitle>
              <DialogDescription>Session ID: {session.id}</DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Session Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center">
                <CheckCircle className="w-4 h-4 mr-2" />
                Session Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <StatusBadge status={session.status} showDescription={true} />
              </div>
              {(() => {
                if (session.status === "active") {
                  return (
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm text-muted-foreground">
                        Duration
                      </span>
                      <span className="font-medium">
                        {realTimeDuration !== null
                          ? formatDurationDetailed(realTimeDuration)
                          : "Calculating..."}
                      </span>
                    </div>
                  );
                }
                return session.duration ? (
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm text-muted-foreground">
                      Duration
                    </span>
                    <span className="font-medium">
                      {formatDurationDetailed(session.duration)}
                    </span>
                  </div>
                ) : null;
              })()}
            </CardContent>
          </Card>

          {/* Time Information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center">
                <Calendar className="w-4 h-4 mr-2" />
                Time Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Check-in Time
                </span>
                <span className="font-medium">
                  {formatSessionTime(session.checkInTime)}
                </span>
              </div>
              {session.checkOutTime && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Check-out Time
                  </span>
                  <span className="font-medium">
                    {formatSessionTime(session.checkOutTime)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Location Information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center">
                <MapPin className="w-4 h-4 mr-2" />
                Location Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">School</span>
                <span className="font-medium">
                  {schoolName || "Unknown School"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Check-in Location
                </span>
                <span className="font-mono text-sm">
                  {formatCoordinates(
                    session.checkInLocation.latitude,
                    session.checkInLocation.longitude
                  )}
                </span>
              </div>
              {session.checkOutLocation && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Check-out Location
                  </span>
                  <span className="font-mono text-sm">
                    {formatCoordinates(
                      session.checkOutLocation.latitude,
                      session.checkOutLocation.longitude
                    )}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* User Information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center">
                <User className="w-4 h-4 mr-2" />
                User Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">User ID</span>
                <span className="font-mono text-sm">{session.userId}</span>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          {session.notes && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center">
                  <FileText className="w-4 h-4 mr-2" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{session.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
