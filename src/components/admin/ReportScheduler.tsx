"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
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
} from "lucide-react";

interface ReportSchedule {
  id: string;
  name: string;
  description: string;
  reportType: "sessions" | "attendance" | "analytics" | "management";
  frequency: "daily" | "weekly" | "monthly" | "quarterly";
  deliveryTime: string;
  recipients: string[];
  filters: {
    dateRange?: string;
    providers?: string[];
    schools?: string[];
    status?: string[];
  };
  format: "pdf" | "csv" | "excel";
  isActive: boolean;
  lastRun?: Date;
  nextRun?: Date;
  createdAt: Date;
  createdBy: string;
}

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
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ReportSchedule | null>(
    null
  );

  const [newSchedule, setNewSchedule] = useState<NewScheduleForm>({
    name: "",
    description: "",
    reportType: "sessions",
    frequency: "weekly",
    deliveryTime: "09:00",
    recipients: "",
    format: "pdf",
  });

  // Mock data for demonstration
  useEffect(() => {
    const mockSchedules: ReportSchedule[] = [
      {
        id: "sched-1",
        name: "Weekly Session Summary",
        description: "Weekly overview of all session activities",
        reportType: "sessions",
        frequency: "weekly",
        deliveryTime: "09:00",
        recipients: ["admin@schoolsin.com", "manager@schoolsin.com"],
        filters: { dateRange: "week" },
        format: "pdf",
        isActive: true,
        lastRun: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        nextRun: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        createdBy: "admin@schoolsin.com",
      },
      {
        id: "sched-2",
        name: "Monthly Analytics Report",
        description: "Comprehensive monthly analytics and insights",
        reportType: "analytics",
        frequency: "monthly",
        deliveryTime: "08:00",
        recipients: ["analytics@schoolsin.com", "director@schoolsin.com"],
        filters: { dateRange: "month" },
        format: "excel",
        isActive: true,
        lastRun: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        nextRun: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        createdBy: "admin@schoolsin.com",
      },
      {
        id: "sched-3",
        name: "Daily Attendance Check",
        description: "Daily attendance summary for operational review",
        reportType: "attendance",
        frequency: "daily",
        deliveryTime: "17:00",
        recipients: ["operations@schoolsin.com"],
        filters: { dateRange: "day" },
        format: "csv",
        isActive: false,
        lastRun: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        nextRun: undefined,
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        createdBy: "operations@schoolsin.com",
      },
    ];
    setSchedules(mockSchedules);
  }, []);

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
  const handleCreateSchedule = () => {
    if (!newSchedule.name || !newSchedule.recipients) {
      setError("Please fill in all required fields");
      return;
    }

    const schedule: ReportSchedule = {
      id: `sched-${Date.now()}`,
      name: newSchedule.name,
      description: newSchedule.description,
      reportType: newSchedule.reportType,
      frequency: newSchedule.frequency,
      deliveryTime: newSchedule.deliveryTime,
      recipients: newSchedule.recipients
        .split(",")
        .map((email) => email.trim()),
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
      nextRun: calculateNextRun(
        newSchedule.frequency,
        newSchedule.deliveryTime
      ),
      createdAt: new Date(),
      createdBy: "current-user@schoolsin.com", // Would be from auth context
    };

    setSchedules((prev) => [...prev, schedule]);
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
    setError(null);
  };

  // Toggle schedule active state
  const toggleScheduleActive = (id: string) => {
    setSchedules((prev) =>
      prev.map((schedule) =>
        schedule.id === id
          ? {
              ...schedule,
              isActive: !schedule.isActive,
              nextRun: !schedule.isActive
                ? calculateNextRun(schedule.frequency, schedule.deliveryTime)
                : undefined,
            }
          : schedule
      )
    );
  };

  // Delete schedule
  const deleteSchedule = (id: string) => {
    setSchedules((prev) => prev.filter((schedule) => schedule.id !== id));
  };

  // Simulate running a report
  const runScheduleNow = (id: string) => {
    setLoading(true);
    setTimeout(() => {
      setSchedules((prev) =>
        prev.map((schedule) =>
          schedule.id === id
            ? {
                ...schedule,
                lastRun: new Date(),
                nextRun: calculateNextRun(
                  schedule.frequency,
                  schedule.deliveryTime
                ),
              }
            : schedule
        )
      );
      setLoading(false);
    }, 2000);
  };

  // Get report type display info
  const getReportTypeInfo = (type: string) => {
    switch (type) {
      case "sessions":
        return {
          label: "Session Reports",
          icon: FileText,
          color: "bg-blue-100 text-blue-800",
        };
      case "attendance":
        return {
          label: "Attendance Summary",
          icon: Users,
          color: "bg-green-100 text-green-800",
        };
      case "analytics":
        return {
          label: "Analytics Dashboard",
          icon: Calendar,
          color: "bg-purple-100 text-purple-800",
        };
      case "management":
        return {
          label: "Session Management",
          icon: Settings,
          color: "bg-orange-100 text-orange-800",
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
        return "bg-red-100 text-red-800";
      case "weekly":
        return "bg-blue-100 text-blue-800";
      case "monthly":
        return "bg-green-100 text-green-800";
      case "quarterly":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

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
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
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
                    <Select
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
                          reportType: value as any,
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
                    <Select
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
                          frequency: value as any,
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
                    <Select
                      options={[
                        { value: "pdf", label: "PDF Document" },
                        { value: "csv", label: "CSV File" },
                        { value: "excel", label: "Excel Spreadsheet" },
                      ]}
                      value={newSchedule.format}
                      onValueChange={(value) =>
                        setNewSchedule((prev) => ({
                          ...prev,
                          format: value as any,
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
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleCreateSchedule}>
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
          <Card>
            <CardContent className="flex flex-col items-center justify-center h-48">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                No Scheduled Reports
              </h3>
              <p className="text-muted-foreground text-center max-w-md">
                Create your first automated report schedule to receive regular
                updates via email.
              </p>
            </CardContent>
          </Card>
        ) : (
          schedules.map((schedule) => {
            const typeInfo = getReportTypeInfo(schedule.reportType);
            const TypeIcon = typeInfo.icon;

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
                            Last: {schedule.lastRun.toLocaleDateString()}
                          </div>
                        )}
                        {schedule.nextRun && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3 w-3 text-blue-600" />
                            Next: {schedule.nextRun.toLocaleDateString()}
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
                      onClick={() => runScheduleNow(schedule.id)}
                      disabled={loading}
                      className="flex items-center gap-2"
                    >
                      <Play className="h-3 w-3" />
                      Run Now
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleScheduleActive(schedule.id)}
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
                      className="flex items-center gap-2"
                    >
                      <Edit className="h-3 w-3" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteSchedule(schedule.id)}
                      className="flex items-center gap-2"
                    >
                      <Trash2 className="h-3 w-3" />
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
                <div className="text-2xl font-bold text-blue-600">
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
