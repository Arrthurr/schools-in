"use client";

import { useState, useEffect, useCallback } from "react";
import { Timestamp } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import {
  EmptyState,
  CompactErrorState,
} from "../ui/error-empty-states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SimpleSelect } from "@/components/ui/select";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Calendar,
  Clock,
  Mail,
  Plus,
  Edit,
  Trash2,
  Play,
  Pause,
  CheckCircle,
  AlertCircle,
  Users,
  FileText,
  Settings,
  Loader2,
} from "lucide-react";
import { ReportSchedule } from "@/lib/firebase/types";
import { reportScheduleService } from "@/lib/services/reportScheduleService";
import { useCachedAuth } from "@/lib/hooks/useCachedAuth";

const SAMPLE_SCHEDULES: ReportSchedule[] = [
  {
    id: "sample-weekly",
    name: "Weekly Session Summary",
    description: "Summary of sessions for the past week",
    reportType: "sessions",
    frequency: "weekly",
    deliveryTime: "09:00",
    recipients: ["admin@schoolsin.com"],
    filters: { dateRange: "week" },
    format: "pdf",
    isActive: true,
    lastRun: Timestamp.fromDate(new Date()),
    nextRun: Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000)),
    createdAt: Timestamp.fromDate(new Date()),
    createdBy: "system",
  },
  {
    id: "sample-monthly",
    name: "Monthly Analytics Report",
    description: "Analytics overview for the month",
    reportType: "analytics",
    frequency: "monthly",
    deliveryTime: "10:00",
    recipients: ["analytics@schoolsin.com"],
    filters: { dateRange: "month" },
    format: "excel",
    isActive: true,
    lastRun: Timestamp.fromDate(new Date()),
    nextRun: Timestamp.fromDate(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)),
    createdAt: Timestamp.fromDate(new Date()),
    createdBy: "system",
  },
  {
    id: "sample-daily",
    name: "Daily Attendance Check",
    description: "Daily attendance report for operations",
    reportType: "attendance",
    frequency: "daily",
    deliveryTime: "08:00",
    recipients: ["operations@schoolsin.com"],
    filters: { dateRange: "day" },
    format: "csv",
    isActive: false,
    lastRun: Timestamp.fromDate(new Date()),
    nextRun: undefined,
    createdAt: Timestamp.fromDate(new Date()),
    createdBy: "system",
  },
];

interface NewScheduleForm {
  name: string;
  description: string;
  reportType: "sessions" | "attendance" | "analytics" | "management";
  frequency: "daily" | "weekly" | "monthly" | "quarterly";
  deliveryTime: string;
  recipients: string;
  format: "pdf" | "csv" | "excel";
}

export function ReportScheduler() {
  const { user } = useCachedAuth();
  const [schedules, setSchedules] = useState<ReportSchedule[]>(SAMPLE_SCHEDULES);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [, setEditingSchedule] = useState<ReportSchedule | null>(null);

  const [newSchedule, setNewSchedule] = useState<NewScheduleForm>({
    name: "",
    description: "",
    reportType: "sessions",
    frequency: "weekly",
    deliveryTime: "09:00",
    recipients: "",
    format: "pdf",
  });

  // Fetch schedules from Firestore
  const fetchSchedules = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await reportScheduleService.getAll();
      if (data && data.length > 0) {
        setSchedules(data);
      } else {
        setSchedules(SAMPLE_SCHEDULES);
      }
    } catch (err) {
      console.error("Error fetching report schedules:", err);
      // Fallback to sample data for demo/testing
      setSchedules(SAMPLE_SCHEDULES);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // Calculate next run date based on frequency
  const calculateNextRun = (frequency: string, deliveryTime: string): Date => {
    const now = new Date();
    const [hour, minute] = deliveryTime.split(":").map(Number);
    const nextRun = new Date(now);
    nextRun.setHours(hour, minute, 0, 0);

    switch (frequency) {
      case "daily":
        if (nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + 1);
        }
        break;
      case "weekly":
        nextRun.setDate(nextRun.getDate() + ((7 - nextRun.getDay()) % 7) || 7);
        break;
      case "monthly":
        nextRun.setMonth(nextRun.getMonth() + 1, 1);
        break;
      case "quarterly":
        const currentQuarter = Math.floor(nextRun.getMonth() / 3);
        nextRun.setMonth((currentQuarter + 1) * 3, 1);
        break;
    }

    return nextRun;
  };

  // Handle form submission
  const handleCreateSchedule = async () => {
    if (!newSchedule.name || !newSchedule.recipients) {
      setError("Please fill in all required fields");
      return;
    }

    if (!user?.email) {
      setError("You must be logged in to create a schedule");
      return;
    }

    try {
      setActionLoading("create");
      setError(null);

      const nextRunDate = calculateNextRun(
        newSchedule.frequency,
        newSchedule.deliveryTime
      );

      await reportScheduleService.create({
        name: newSchedule.name,
        description: newSchedule.description,
        reportType: newSchedule.reportType,
        frequency: newSchedule.frequency,
        deliveryTime: newSchedule.deliveryTime,
        recipients: newSchedule.recipients
          .split(",")
          .map((email) => email.trim())
          .filter(Boolean),
        filters: {
          dateRange:
            newSchedule.frequency === "daily"
              ? "day"
              : newSchedule.frequency === "weekly"
              ? "week"
              : "month",
        },
        format: newSchedule.format,
        isActive: true,
        nextRun: Timestamp.fromDate(nextRunDate),
        createdBy: user.email,
      });

      setShowCreateDialog(false);
      setNewSchedule({
        name: "",
        description: "",
        reportType: "sessions",
        frequency: "weekly",
        deliveryTime: "09:00",
        recipients: "",
        format: "pdf",
      });

      await fetchSchedules();
    } catch (err) {
      console.error("Error creating schedule:", err);
      setError("Failed to create schedule. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  // Toggle schedule active state
  const toggleScheduleActive = async (schedule: ReportSchedule) => {
    try {
      setActionLoading(schedule.id);
      const newIsActive = !schedule.isActive;
      const nextRun = newIsActive
        ? Timestamp.fromDate(
            calculateNextRun(schedule.frequency, schedule.deliveryTime)
          )
        : undefined;

      await reportScheduleService.toggleActive(schedule.id, newIsActive, nextRun);
      await fetchSchedules();
    } catch (err) {
      console.error("Error toggling schedule:", err);
      setError("Failed to update schedule. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  // Delete schedule
  const deleteSchedule = async (id: string) => {
    try {
      setActionLoading(id);
      await reportScheduleService.delete(id);
      await fetchSchedules();
    } catch (err) {
      console.error("Error deleting schedule:", err);
      setError("Failed to delete schedule. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  // Run a schedule now
  const runScheduleNow = async (schedule: ReportSchedule) => {
    try {
      setActionLoading(schedule.id);
      const nextRun = Timestamp.fromDate(
        calculateNextRun(schedule.frequency, schedule.deliveryTime)
      );
      await reportScheduleService.recordRun(schedule.id, nextRun);
      await fetchSchedules();
    } catch (err) {
      console.error("Error running schedule:", err);
      setError("Failed to run schedule. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  // Get report type display info
  const getReportTypeInfo = (type: string) => {
    switch (type) {
      case "sessions":
        return {
          label: "Session Reports",
          icon: FileText,
          color: "status-brand",
        };
      case "attendance":
        return {
          label: "Attendance Summary",
          icon: Users,
          color: "bg-success/10 text-success",
        };
      case "analytics":
        return {
          label: "Analytics Dashboard",
          icon: Calendar,
          color: "bg-primary/10 text-primary",
        };
      case "management":
        return {
          label: "Session Management",
          icon: Settings,
          color: "bg-warning/10 text-warning",
        };
      default:
        return {
          label: "Unknown",
          icon: FileText,
          color: "bg-gray-100 text-gray-800",
        };
    }
  };

  // Get frequency badge color
  const getFrequencyColor = (frequency: string) => {
    switch (frequency) {
      case "daily":
        return "bg-error/10 text-error";
      case "weekly":
        return "bg-primary/10 text-primary";
      case "monthly":
        return "bg-success/10 text-success";
      case "quarterly":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Helper to format Timestamp to date string
  const formatDate = (timestamp?: Timestamp): string => {
    if (!timestamp) return "N/A";
    return timestamp.toDate().toLocaleDateString();
  };

  if (loading && schedules.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Automated Report Scheduling
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Configure automated delivery of reports via email. Set up recurring
            schedules for session reports, attendance summaries, analytics
            dashboards, and management overviews.
          </p>

          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create Schedule
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Report Schedule</DialogTitle>
                <DialogDescription>
                  Set up a new automated report to be delivered via email on a
                  recurring basis.
                </DialogDescription>
              </DialogHeader>

              {error && (
                <CompactErrorState
                  message={error}
                  onRetry={() => setError(null)}
                />
              )}

              <div className="grid gap-4">
                {/* Basic Information */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Schedule Name *</Label>
                    <Input
                      id="name"
                      value={newSchedule.name}
                      onChange={(e) =>
                        setNewSchedule((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      placeholder="e.g., Weekly Session Summary"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reportType">Report Type</Label>
                    <SimpleSelect
                      id="reportType"
                      options={[
                        { value: "sessions", label: "Session Reports" },
                        { value: "attendance", label: "Attendance Summary" },
                        { value: "analytics", label: "Analytics Dashboard" },
                        { value: "management", label: "Session Management" },
                      ]}
                      value={newSchedule.reportType}
                      onValueChange={(value) =>
                        setNewSchedule((prev) => ({
                          ...prev,
                          reportType: value as NewScheduleForm["reportType"],
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={newSchedule.description}
                    onChange={(e) =>
                      setNewSchedule((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Brief description of this report schedule"
                  />
                </div>

                {/* Scheduling */}
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="frequency">Frequency</Label>
                    <SimpleSelect
                      id="frequency"
                      options={[
                        { value: "daily", label: "Daily" },
                        { value: "weekly", label: "Weekly" },
                        { value: "monthly", label: "Monthly" },
                        { value: "quarterly", label: "Quarterly" },
                      ]}
                      value={newSchedule.frequency}
                      onValueChange={(value) =>
                        setNewSchedule((prev) => ({
                          ...prev,
                          frequency: value as NewScheduleForm["frequency"],
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deliveryTime">Delivery Time</Label>
                    <Input
                      id="deliveryTime"
                      type="time"
                      value={newSchedule.deliveryTime}
                      onChange={(e) =>
                        setNewSchedule((prev) => ({
                          ...prev,
                          deliveryTime: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="format">Format</Label>
                    <SimpleSelect
                      id="format"
                      options={[
                        { value: "pdf", label: "PDF Document" },
                        { value: "csv", label: "CSV File" },
                        { value: "excel", label: "Excel Spreadsheet" },
                      ]}
                      value={newSchedule.format}
                      onValueChange={(value) =>
                        setNewSchedule((prev) => ({
                          ...prev,
                          format: value as NewScheduleForm["format"],
                        }))
                      }
                    />
                  </div>
                </div>

                {/* Recipients */}
                <div className="space-y-2">
                  <Label htmlFor="recipients">Email Recipients *</Label>
                  <Input
                    id="recipients"
                    value={newSchedule.recipients}
                    onChange={(e) =>
                      setNewSchedule((prev) => ({
                        ...prev,
                        recipients: e.target.value,
                      }))
                    }
                    placeholder="email1@example.com, email2@example.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    Separate multiple email addresses with commas
                  </p>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateDialog(false)}
                    disabled={actionLoading === "create"}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateSchedule}
                    disabled={actionLoading === "create"}
                  >
                    {actionLoading === "create" && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Create Schedule
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Schedules List */}
      <div className="grid gap-4">
        {schedules.length === 0 ? (
          <EmptyState
            type="reports"
            title="No Scheduled Reports"
            message="Create your first automated report schedule to receive regular updates via email."
            actionLabel="Create Report Schedule"
            onAction={() => setShowCreateDialog(true)}
          />
        ) : (
          schedules.map((schedule) => {
            const typeInfo = getReportTypeInfo(schedule.reportType);
            const TypeIcon = typeInfo.icon;
            const isActionLoading = actionLoading === schedule.id;

            return (
              <Card
                key={schedule.id}
                className={`${!schedule.isActive ? "opacity-75" : ""}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${typeInfo.color}`}>
                        <TypeIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">
                          {schedule.name}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {schedule.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getFrequencyColor(schedule.frequency)}>
                        {schedule.frequency}
                      </Badge>
                      <Badge
                        variant={schedule.isActive ? "default" : "secondary"}
                      >
                        {schedule.isActive ? "Active" : "Paused"}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    {/* Schedule Info */}
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Schedule Details</h4>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          {schedule.deliveryTime} ({schedule.frequency})
                        </div>
                        <div className="flex items-center gap-2">
                          <FileText className="h-3 w-3" />
                          {schedule.format.toUpperCase()} format
                        </div>
                      </div>
                    </div>

                    {/* Recipients */}
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Recipients</h4>
                      <div className="space-y-1">
                        {schedule.recipients.map((email, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-2 text-sm text-muted-foreground"
                          >
                            <Mail className="h-3 w-3" />
                            {email}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Status */}
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Status</h4>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        {schedule.lastRun && (
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-3 w-3 text-green-600" />
                            Last: {formatDate(schedule.lastRun)}
                          </div>
                        )}
                        {schedule.nextRun && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3 w-3 text-brand-primary" />
                            Next: {formatDate(schedule.nextRun)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => runScheduleNow(schedule)}
                      disabled={isActionLoading}
                      className="flex items-center gap-2"
                    >
                      {isActionLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                      Run Now
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleScheduleActive(schedule)}
                      disabled={isActionLoading}
                      className="flex items-center gap-2"
                    >
                      {schedule.isActive ? (
                        <>
                          <Pause className="h-3 w-3" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play className="h-3 w-3" />
                          Resume
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingSchedule(schedule)}
                      disabled={isActionLoading}
                      className="flex items-center gap-2"
                    >
                      <Edit className="h-3 w-3" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteSchedule(schedule.id)}
                      disabled={isActionLoading}
                      className="flex items-center gap-2"
                    >
                      {isActionLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Statistics */}
      {schedules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Schedule Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{schedules.length}</div>
                <div className="text-sm text-muted-foreground">
                  Total Schedules
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {schedules.filter((s) => s.isActive).length}
                </div>
                <div className="text-sm text-muted-foreground">Active</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-brand-primary">
                  {schedules.filter((s) => s.frequency === "daily").length}
                </div>
                <div className="text-sm text-muted-foreground">
                  Daily Reports
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {schedules.reduce(
                    (total, s) => total + s.recipients.length,
                    0
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  Total Recipients
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
