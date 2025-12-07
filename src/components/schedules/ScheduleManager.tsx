"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CalendarClock,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Schedule, Service, Location } from "@/lib/firebase/types";
import {
  createSchedule,
  deleteSchedule,
  getSchedulesByProvider,
  updateSchedule,
} from "@/lib/services/scheduleService";
import { getAssignedLocations } from "@/lib/services/locationService";
import { getAllServices } from "@/lib/services/serviceService";
import { useAuth } from "@/lib/hooks/useAuth";

interface ScheduleManagerProps {
  providerId: string;
  providerName?: string;
  isOpen: boolean;
  onClose: () => void;
}

interface FormState {
  id?: string;
  locationId: string;
  serviceId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

const dayOptions = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

function sortSchedules(a: Schedule, b: Schedule) {
  if (a.dayOfWeek === b.dayOfWeek) {
    return a.startTime.localeCompare(b.startTime);
  }
  return a.dayOfWeek - b.dayOfWeek;
}

export function ScheduleManager({
  providerId,
  providerName,
  isOpen,
  onClose,
}: ScheduleManagerProps) {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    locationId: "",
    serviceId: "",
    dayOfWeek: 1,
    startTime: "09:00",
    endTime: "11:00",
    isActive: true,
  });

  const locationNameById = useMemo(
    () =>
      locations.reduce<Record<string, string>>(
        (acc, loc) => ({ ...acc, [loc.id]: loc.name }),
        {}
      ),
    [locations]
  );

  const serviceNameById = useMemo(
    () =>
      services.reduce<Record<string, string>>(
        (acc, svc) => ({ ...acc, [svc.id]: svc.name }),
        {}
      ),
    [services]
  );

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setSaving(false);
    loadData();
  }, [isOpen, providerId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [scheduleData, locationData, serviceData] = await Promise.all([
        getSchedulesByProvider(providerId),
        getAssignedLocations(providerId),
        getAllServices(true),
      ]);
      setSchedules(scheduleData.sort(sortSchedules));
      setLocations(locationData);
      setServices(serviceData);

      setForm((prev) => ({
        ...prev,
        locationId: locationData[0]?.id ?? "",
        serviceId: serviceData[0]?.id ?? "",
      }));
    } catch (err) {
      console.error("Failed to load schedules", err);
      setError("Failed to load schedules. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      locationId: locations[0]?.id ?? "",
      serviceId: services[0]?.id ?? "",
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "11:00",
      isActive: true,
    });
  };

  const validateTimes = (start: string, end: string) => {
    return start < end;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!form.locationId || !form.serviceId) {
      setError("Please choose a location and service.");
      return;
    }

    if (!validateTimes(form.startTime, form.endTime)) {
      setError("End time must be after start time.");
      return;
    }

    try {
      setSaving(true);

      if (form.id) {
        await updateSchedule(form.id, {
          locationId: form.locationId,
          serviceId: form.serviceId,
          dayOfWeek: form.dayOfWeek,
          startTime: form.startTime,
          endTime: form.endTime,
          isActive: form.isActive,
        });
      } else {
        await createSchedule({
          providerId,
          locationId: form.locationId,
          serviceId: form.serviceId,
          dayOfWeek: form.dayOfWeek,
          startTime: form.startTime,
          endTime: form.endTime,
          isActive: form.isActive,
          createdBy: user?.uid || "admin",
        });
      }

      const refreshed = await getSchedulesByProvider(providerId);
      setSchedules(refreshed.sort(sortSchedules));
      resetForm();
    } catch (err) {
      console.error("Failed to save schedule", err);
      setError("Failed to save schedule. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (schedule: Schedule) => {
    setForm({
      id: schedule.id,
      locationId: schedule.locationId,
      serviceId: schedule.serviceId,
      dayOfWeek: schedule.dayOfWeek,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      isActive: schedule.isActive !== false,
    });
  };

  const handleDelete = async (scheduleId: string) => {
    try {
      setSaving(true);
      await deleteSchedule(scheduleId);
      setSchedules((prev) =>
        prev
          .map((item) =>
            item.id === scheduleId ? { ...item, isActive: false } : item
          )
          .sort(sortSchedules)
      );
    } catch (err) {
      console.error("Failed to delete schedule", err);
      setError("Failed to delete schedule. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const groupedByDay = useMemo(() => {
    return schedules.reduce<Record<number, Schedule[]>>((acc, schedule) => {
      const day = schedule.dayOfWeek;
      acc[day] = acc[day] ? [...acc[day], schedule] : [schedule];
      return acc;
    }, {});
  }, [schedules]);

  const hasLocations = locations.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            Manage schedules for {providerName || "Provider"}
          </DialogTitle>
          <DialogDescription>
            Create, edit, or disable provider schedules for assigned schools.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            Loading schedules...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Location (assigned only)
                  </label>
                  <select
                    value={form.locationId}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        locationId: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    disabled={!hasLocations}
                    required
                  >
                    {!hasLocations && (
                      <option value="">No assigned schools</option>
                    )}
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                  {!hasLocations && (
                    <p className="text-xs text-muted-foreground">
                      Assign this provider to a school before adding schedules.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Service
                  </label>
                  <select
                    value={form.serviceId}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        serviceId: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    required
                  >
                    {services.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Day of week
                    </label>
                    <select
                      value={form.dayOfWeek}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          dayOfWeek: Number(e.target.value),
                        }))
                      }
                      className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {dayOptions.map((day) => (
                        <option key={day.value} value={day.value}>
                          {day.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Active
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={form.isActive}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            isActive: e.target.checked,
                          }))
                        }
                        className="rounded border-input text-brand-primary focus:ring-brand-primary"
                      />
                      <span className="text-sm text-muted-foreground">
                        Show in schedules and alerts
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Start time
                    </label>
                    <Input
                      type="time"
                      value={form.startTime}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          startTime: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      End time
                    </label>
                    <Input
                      type="time"
                      value={form.endTime}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          endTime: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                </div>

                <DialogFooter className="flex justify-between gap-2">
                  <div className="text-xs text-muted-foreground">
                    Times are stored in 24-hour format.
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        resetForm();
                        setForm((prev) => ({ ...prev, id: undefined }));
                      }}
                    >
                      Clear
                    </Button>
                    <Button type="submit" disabled={saving || !hasLocations}>
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          {form.id ? "Update schedule" : "Add schedule"}
                        </>
                      )}
                    </Button>
                  </div>
                </DialogFooter>
              </form>
            </div>

            <div className="lg:col-span-3">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-base font-semibold">Existing schedules</h3>
                  <p className="text-sm text-muted-foreground">
                    Grouped by day of week
                  </p>
                </div>
              </div>
              <ScrollArea className="h-[420px] pr-2">
                {schedules.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <CalendarClock className="h-6 w-6 mb-2" />
                    No schedules yet
                  </div>
                ) : (
                  <div className="space-y-4">
                    {dayOptions.map((day) => {
                      const daySchedules = groupedByDay[day.value] || [];
                      if (daySchedules.length === 0) return null;
                      return (
                        <div
                          key={day.value}
                          className="border rounded-lg p-3 space-y-3"
                        >
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{day.label}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {daySchedules.length} item
                              {daySchedules.length > 1 ? "s" : ""}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {daySchedules
                              .sort(sortSchedules)
                              .map((schedule) => (
                                <div
                                  key={schedule.id}
                                  className="flex items-start justify-between border rounded-md p-3 bg-muted/50"
                                >
                                  <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Badge variant="outline">
                                        {locationNameById[schedule.locationId] ||
                                          "Location"}
                                      </Badge>
                                      <Badge variant="outline">
                                        {serviceNameById[schedule.serviceId] ||
                                          "Service"}
                                      </Badge>
                                      <Badge
                                        variant={
                                          schedule.isActive === false
                                            ? "secondary"
                                            : "default"
                                        }
                                      >
                                        {schedule.isActive === false
                                          ? "Inactive"
                                          : "Active"}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                      <span className="font-medium">
                                        {schedule.startTime} — {schedule.endTime}
                                      </span>
                                      <span className="text-muted-foreground text-xs">
                                        <MapPin className="h-3 w-3 inline mr-1" />
                                        {locationNameById[schedule.locationId] ||
                                          "Unknown school"}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={() => handleEdit(schedule)}
                                      aria-label="Edit schedule"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={() => handleDelete(schedule.id)}
                                      disabled={saving}
                                      aria-label="Delete schedule"
                                      className="text-red-600 hover:text-red-700"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
