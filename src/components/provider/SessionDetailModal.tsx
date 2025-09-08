import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
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
import { formatSessionTime, formatDuration } from "@/lib/utils/session";

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
  if (!session) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        );
      case "active":
        return (
          <Badge variant="default" className="bg-blue-100 text-blue-800">
            <Clock className="w-3 h-3 mr-1" />
            Active
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive">
            <AlertCircle className="w-3 h-3 mr-1" />
            Error
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

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
              <DialogDescription>
                Session ID: {session.id}
              </DialogDescription>
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
                {getStatusBadge(session.status)}
              </div>
              {session.duration && (
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm text-muted-foreground">Duration</span>
                  <span className="font-medium">{formatDuration(session.duration)}</span>
                </div>
              )}
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
                <span className="text-sm text-muted-foreground">Check-in Time</span>
                <span className="font-medium">{formatSessionTime(session.checkInTime)}</span>
              </div>
              {session.checkOutTime && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Check-out Time</span>
                  <span className="font-medium">{formatSessionTime(session.checkOutTime)}</span>
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
                <span className="font-medium">{schoolName || "Unknown School"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Check-in Location</span>
                <span className="font-mono text-sm">
                  {formatCoordinates(session.checkInLocation.latitude, session.checkInLocation.longitude)}
                </span>
              </div>
              {session.checkOutLocation && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Check-out Location</span>
                  <span className="font-mono text-sm">
                    {formatCoordinates(session.checkOutLocation.latitude, session.checkOutLocation.longitude)}
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
