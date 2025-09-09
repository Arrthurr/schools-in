"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Edit,
  X,
  Clock,
  AlertTriangle,
  Save,
  RotateCcw,
  MapPin,
  User,
  School,
  Calendar,
} from "lucide-react";
import {
  formatDuration,
  getSessionStatusConfig,
  calculateSessionDuration,
} from "@/lib/utils/session";
import { SessionData } from "@/lib/utils/session";
import {
  getCollection,
  updateDocument,
  COLLECTIONS,
} from "@/lib/firebase/firestore";
import { Timestamp } from "firebase/firestore";

interface School {
  id: string;
  name: string;
  address: string;
}

interface User {
  id: string;
  email: string;
  displayName?: string;
  role: "provider" | "admin";
}

interface SessionCorrectionData {
  id: string;
  userId: string;
  schoolId: string;
  checkInTime: Timestamp;
  checkOutTime?: Timestamp;
  status: "active" | "completed" | "error" | "paused" | "cancelled";
  notes?: string;
  checkInLocation: {
    latitude: number;
    longitude: number;
  };
  checkOutLocation?: {
    latitude: number;
    longitude: number;
  };
}

interface CorrectionFormData {
  checkInTime: string;
  checkInDate: string;
  checkOutTime?: string;
  checkOutDate?: string;
  status: string;
  notes: string;
  checkInLatitude: string;
  checkInLongitude: string;
  checkOutLatitude?: string;
  checkOutLongitude?: string;
}

export function SessionManagement() {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [providers, setProviders] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<SessionData | null>(
    null
  );
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isForceCloseDialogOpen, setIsForceCloseDialogOpen] = useState(false);
  const [correctionForm, setCorrectionForm] = useState<CorrectionFormData>({
    checkInTime: "",
    checkInDate: "",
    checkOutTime: "",
    checkOutDate: "",
    status: "",
    notes: "",
    checkInLatitude: "",
    checkInLongitude: "",
    checkOutLatitude: "",
    checkOutLongitude: "",
  });

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        const [schoolsData, usersData, sessionsData] = await Promise.all([
          getCollection(COLLECTIONS.LOCATIONS),
          getCollection(COLLECTIONS.USERS),
          getCollection(COLLECTIONS.SESSIONS),
        ]);

        setSchools(schoolsData as School[]);
        setProviders(
          (usersData as User[]).filter((user: User) => user.role === "provider")
        );
        setSessions(sessionsData as SessionData[]);
      } catch (err) {
        console.error("Error loading initial data:", err);
        setError("Failed to load session data");
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  // Get school name by ID
  const getSchoolName = (schoolId: string) => {
    const school = schools.find((s) => s.id === schoolId);
    return school?.name || "Unknown School";
  };

  // Get provider name by ID
  const getProviderName = (userId: string) => {
    const provider = providers.find((p) => p.id === userId);
    return provider?.displayName || provider?.email || "Unknown Provider";
  };

  // Open edit dialog with session data
  const openEditDialog = (session: SessionData) => {
    setSelectedSession(session);

    const checkInDate = session.checkInTime.toDate();
    const checkOutDate = session.checkOutTime?.toDate();

    setCorrectionForm({
      checkInDate: checkInDate.toISOString().split("T")[0],
      checkInTime: checkInDate.toTimeString().split(" ")[0].slice(0, 5),
      checkOutDate: checkOutDate
        ? checkOutDate.toISOString().split("T")[0]
        : "",
      checkOutTime: checkOutDate
        ? checkOutDate.toTimeString().split(" ")[0].slice(0, 5)
        : "",
      status: session.status,
      notes: session.notes || "",
      checkInLatitude: session.checkInLocation.latitude.toString(),
      checkInLongitude: session.checkInLocation.longitude.toString(),
      checkOutLatitude: session.checkOutLocation?.latitude?.toString() || "",
      checkOutLongitude: session.checkOutLocation?.longitude?.toString() || "",
    });

    setIsEditDialogOpen(true);
  };

  // Open force close dialog
  const openForceCloseDialog = (session: SessionData) => {
    setSelectedSession(session);

    const now = new Date();
    setCorrectionForm({
      checkInDate: session.checkInTime.toDate().toISOString().split("T")[0],
      checkInTime: session.checkInTime
        .toDate()
        .toTimeString()
        .split(" ")[0]
        .slice(0, 5),
      checkOutDate: now.toISOString().split("T")[0],
      checkOutTime: now.toTimeString().split(" ")[0].slice(0, 5),
      status: "completed",
      notes: session.notes || "Force-closed by administrator",
      checkInLatitude: session.checkInLocation.latitude.toString(),
      checkInLongitude: session.checkInLocation.longitude.toString(),
      checkOutLatitude: session.checkInLocation.latitude.toString(), // Use same location
      checkOutLongitude: session.checkInLocation.longitude.toString(),
    });

    setIsForceCloseDialogOpen(true);
  };

  // Handle form input changes
  const handleFormChange = (field: keyof CorrectionFormData, value: string) => {
    setCorrectionForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Save session corrections
  const saveSessionCorrections = async () => {
    if (!selectedSession?.id) return;

    try {
      setLoading(true);
      setError(null);

      // Parse form data back to proper format
      const checkInDateTime = new Date(
        `${correctionForm.checkInDate}T${correctionForm.checkInTime}`
      );
      const checkOutDateTime =
        correctionForm.checkOutDate && correctionForm.checkOutTime
          ? new Date(
              `${correctionForm.checkOutDate}T${correctionForm.checkOutTime}`
            )
          : undefined;

      const correctedSession: Partial<SessionCorrectionData> = {
        checkInTime: Timestamp.fromDate(checkInDateTime),
        checkOutTime: checkOutDateTime
          ? Timestamp.fromDate(checkOutDateTime)
          : undefined,
        status: correctionForm.status as SessionData["status"],
        notes: correctionForm.notes,
        checkInLocation: {
          latitude: parseFloat(correctionForm.checkInLatitude),
          longitude: parseFloat(correctionForm.checkInLongitude),
        },
      };

      if (correctionForm.checkOutLatitude && correctionForm.checkOutLongitude) {
        correctedSession.checkOutLocation = {
          latitude: parseFloat(correctionForm.checkOutLatitude),
          longitude: parseFloat(correctionForm.checkOutLongitude),
        };
      }

      // Update the session in Firestore
      await updateDocument(
        COLLECTIONS.SESSIONS,
        selectedSession.id,
        correctedSession
      );

      // Update local state
      setSessions((prev) =>
        prev.map((session) =>
          session.id === selectedSession.id
            ? { ...session, ...correctedSession }
            : session
        )
      );

      setIsEditDialogOpen(false);
      setIsForceCloseDialogOpen(false);
      setSelectedSession(null);
    } catch (err) {
      console.error("Error saving session corrections:", err);
      setError("Failed to save session corrections");
    } finally {
      setLoading(false);
    }
  };

  // Filter sessions that need attention (active, error, or very long duration)
  const getSessionsNeedingAttention = () => {
    const now = new Date();
    const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);

    return sessions.filter((session) => {
      const isStuck =
        session.status === "active" &&
        session.checkInTime.toDate() < twelveHoursAgo;
      const hasError = session.status === "error";
      const isPaused = session.status === "paused";

      return isStuck || hasError || isPaused;
    });
  };

  const sessionsNeedingAttention = getSessionsNeedingAttention();

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Session Management & Corrections
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Manage and correct session data, force-close stuck sessions, and
            resolve error states.
          </p>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Sessions Needing Attention */}
      {sessionsNeedingAttention.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              Sessions Needing Attention ({sessionsNeedingAttention.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>School</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessionsNeedingAttention.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="font-medium">
                        {getProviderName(session.userId)}
                      </TableCell>
                      <TableCell>{getSchoolName(session.schoolId)}</TableCell>
                      <TableCell>
                        {session.checkInTime.toDate().toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {session.checkOutTime
                          ? formatDuration(
                              calculateSessionDuration(
                                session.checkInTime,
                                session.checkOutTime
                              )
                            )
                          : formatDuration(
                              Math.floor(
                                (Date.now() -
                                  session.checkInTime.toDate().getTime()) /
                                  (1000 * 60)
                              )
                            )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            session.status === "error"
                              ? "destructive"
                              : session.status === "active"
                              ? "secondary"
                              : "default"
                          }
                        >
                          {getSessionStatusConfig(session.status).label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditDialog(session)}
                          >
                            <Edit className="h-3 w-3" />
                            Edit
                          </Button>
                          {session.status === "active" && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => openForceCloseDialog(session)}
                            >
                              <X className="h-3 w-3" />
                              Force Close
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Sessions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            All Sessions ({sessions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {loading ? "Loading sessions..." : "No sessions found"}
            </div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>School</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Check Out</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="font-medium">
                        {getProviderName(session.userId)}
                      </TableCell>
                      <TableCell>{getSchoolName(session.schoolId)}</TableCell>
                      <TableCell>
                        {session.checkInTime.toDate().toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {session.checkOutTime
                          ? session.checkOutTime.toDate().toLocaleString()
                          : "Active"}
                      </TableCell>
                      <TableCell>
                        {session.checkOutTime
                          ? formatDuration(
                              calculateSessionDuration(
                                session.checkInTime,
                                session.checkOutTime
                              )
                            )
                          : formatDuration(
                              Math.floor(
                                (Date.now() -
                                  session.checkInTime.toDate().getTime()) /
                                  (1000 * 60)
                              )
                            )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            session.status === "error"
                              ? "destructive"
                              : session.status === "active"
                              ? "secondary"
                              : session.status === "completed"
                              ? "default"
                              : "outline"
                          }
                        >
                          {getSessionStatusConfig(session.status).label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(session)}
                        >
                          <Edit className="h-3 w-3" />
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Session Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Edit Session
            </DialogTitle>
            <DialogDescription>
              Correct session data for{" "}
              {selectedSession ? getProviderName(selectedSession.userId) : ""}
              {" at "}
              {selectedSession ? getSchoolName(selectedSession.schoolId) : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Check In Details */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Check In Details
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="checkInDate">Check In Date</Label>
                  <Input
                    id="checkInDate"
                    type="date"
                    value={correctionForm.checkInDate}
                    onChange={(e) =>
                      handleFormChange("checkInDate", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="checkInTime">Check In Time</Label>
                  <Input
                    id="checkInTime"
                    type="time"
                    value={correctionForm.checkInTime}
                    onChange={(e) =>
                      handleFormChange("checkInTime", e.target.value)
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="checkInLatitude">Check In Latitude</Label>
                  <Input
                    id="checkInLatitude"
                    type="number"
                    step="any"
                    value={correctionForm.checkInLatitude}
                    onChange={(e) =>
                      handleFormChange("checkInLatitude", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="checkInLongitude">Check In Longitude</Label>
                  <Input
                    id="checkInLongitude"
                    type="number"
                    step="any"
                    value={correctionForm.checkInLongitude}
                    onChange={(e) =>
                      handleFormChange("checkInLongitude", e.target.value)
                    }
                  />
                </div>
              </div>
            </div>

            {/* Check Out Details */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Check Out Details
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="checkOutDate">Check Out Date</Label>
                  <Input
                    id="checkOutDate"
                    type="date"
                    value={correctionForm.checkOutDate}
                    onChange={(e) =>
                      handleFormChange("checkOutDate", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="checkOutTime">Check Out Time</Label>
                  <Input
                    id="checkOutTime"
                    type="time"
                    value={correctionForm.checkOutTime}
                    onChange={(e) =>
                      handleFormChange("checkOutTime", e.target.value)
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="checkOutLatitude">Check Out Latitude</Label>
                  <Input
                    id="checkOutLatitude"
                    type="number"
                    step="any"
                    value={correctionForm.checkOutLatitude}
                    onChange={(e) =>
                      handleFormChange("checkOutLatitude", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="checkOutLongitude">Check Out Longitude</Label>
                  <Input
                    id="checkOutLongitude"
                    type="number"
                    step="any"
                    value={correctionForm.checkOutLongitude}
                    onChange={(e) =>
                      handleFormChange("checkOutLongitude", e.target.value)
                    }
                  />
                </div>
              </div>
            </div>

            {/* Status and Notes */}
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="status">Session Status</Label>
                <Select
                  options={[
                    { value: "active", label: "Active" },
                    { value: "completed", label: "Completed" },
                    { value: "paused", label: "Paused" },
                    { value: "cancelled", label: "Cancelled" },
                    { value: "error", label: "Error" },
                  ]}
                  value={correctionForm.status}
                  onValueChange={(value) => handleFormChange("status", value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="notes">Session Notes</Label>
                <Textarea
                  id="notes"
                  value={correctionForm.notes}
                  onChange={(e) => handleFormChange("notes", e.target.value)}
                  placeholder="Add notes about this session or correction..."
                  rows={3}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={saveSessionCorrections}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Force Close Dialog */}
      <Dialog
        open={isForceCloseDialogOpen}
        onOpenChange={setIsForceCloseDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <X className="h-5 w-5" />
              Force Close Session
            </DialogTitle>
            <DialogDescription>
              This will force-close the active session for{" "}
              {selectedSession ? getProviderName(selectedSession.userId) : ""}
              {" at "}
              {selectedSession ? getSchoolName(selectedSession.schoolId) : ""}.
              The check-out time will be set to now.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="forceCloseDate">Check Out Date</Label>
                <Input
                  id="forceCloseDate"
                  type="date"
                  value={correctionForm.checkOutDate}
                  onChange={(e) =>
                    handleFormChange("checkOutDate", e.target.value)
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="forceCloseTime">Check Out Time</Label>
                <Input
                  id="forceCloseTime"
                  type="time"
                  value={correctionForm.checkOutTime}
                  onChange={(e) =>
                    handleFormChange("checkOutTime", e.target.value)
                  }
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="forceCloseNotes">Notes</Label>
              <Textarea
                id="forceCloseNotes"
                value={correctionForm.notes}
                onChange={(e) => handleFormChange("notes", e.target.value)}
                placeholder="Reason for force-closing this session..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsForceCloseDialogOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={saveSessionCorrections}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              {loading ? "Closing..." : "Force Close Session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
