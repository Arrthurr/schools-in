"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Session } from "@/lib/firebase/types";
import { sessionsToCSV, downloadCSV } from "@/lib/utils/csv";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "../../../firebase.config";
import { COLLECTIONS } from "@/lib/firebase/firestore";

interface CsvExportButtonProps {
  className?: string;
  variant?:
    | "default"
    | "outline"
    | "secondary"
    | "ghost"
    | "link"
    | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
}

export function CsvExportButton({
  className,
  variant = "outline",
  size = "default",
}: CsvExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [includeUserData, setIncludeUserData] = useState(true);
  const [includeLocationData, setIncludeLocationData] = useState(true);
  const [includeActiveOnly, setIncludeActiveOnly] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    if (!startDate || !endDate) {
      toast({
        title: "Date range required",
        description: "Please select both start and end dates for the export.",
        variant: "destructive",
      });
      return;
    }

    if (startDate > endDate) {
      toast({
        title: "Invalid date range",
        description: "Start date must be before end date.",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);

    try {
      // Convert dates to start/end of day in America/Chicago timezone
      const startOfDay = new Date(startDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Build Firestore query
      let sessionQuery = query(
        collection(db, COLLECTIONS.SESSIONS),
        where("startTime", ">=", startOfDay),
        where("startTime", "<=", endOfDay),
        orderBy("startTime", "desc")
      );

      // If only active sessions, add status filter
      if (includeActiveOnly) {
        sessionQuery = query(
          collection(db, COLLECTIONS.SESSIONS),
          where("status", "==", "active"),
          where("startTime", ">=", startOfDay),
          where("startTime", "<=", endOfDay),
          orderBy("startTime", "desc")
        );
      }

      const snapshot = await getDocs(sessionQuery);
      const sessions = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Session[];

      if (sessions.length === 0) {
        toast({
          title: "No data found",
          description: "No sessions found in the selected date range.",
          variant: "default",
        });
        return;
      }

      // Enrich with user and location data if requested
      let enrichedSessions = sessions;

      if (includeUserData || includeLocationData) {
        const userIds = includeUserData
          ? Array.from(new Set(sessions.map((s) => s.userId)))
          : [];
        const locationIds = includeLocationData
          ? Array.from(new Set(sessions.map((s) => s.locationId)))
          : [];

        const [userPromises, locationPromises] = await Promise.all([
          includeUserData
            ? Promise.all(
                userIds.map(async (uid) => {
                  try {
                    const { CachedUserService } = await import(
                      "@/lib/services/cachedUserService"
                    );
                    return await CachedUserService.getUserById(uid);
                  } catch {
                    return null;
                  }
                })
              )
            : [],
          includeLocationData
            ? Promise.all(
                locationIds.map(async (lid) => {
                  try {
                    const { CachedSchoolService } = await import(
                      "@/lib/services/cachedSchoolService"
                    );
                    return await CachedSchoolService.getSchoolById(lid);
                  } catch {
                    return null;
                  }
                })
              )
            : [],
        ]);

        const userMap = new Map();
        userPromises.forEach((user) => {
          if (user) userMap.set(user.uid, user);
        });

        const locationMap = new Map();
        locationPromises.forEach((location) => {
          if (location) locationMap.set(location.id, location);
        });

        enrichedSessions = sessions.map((session) => ({
          ...session,
          providerName: userMap.get(session.userId)?.displayName,
          providerEmail: userMap.get(session.userId)?.email,
          locationName: locationMap.get(session.locationId)?.name,
          locationAddress: locationMap.get(session.locationId)?.address,
        }));
      }

      // Generate CSV
      const csv = sessionsToCSV(
        enrichedSessions,
        includeUserData,
        includeLocationData
      );

      // Generate filename with date range
      const startStr = startDate.toISOString().split("T")[0];
      const endStr = endDate.toISOString().split("T")[0];
      const filename = `sessions_${startStr}_to_${endStr}.csv`;

      // Download CSV
      downloadCSV(filename, csv);

      toast({
        title: "Export successful",
        description: `Downloaded ${sessions.length} sessions to ${filename}`,
        variant: "default",
      });

      setIsOpen(false);
    } catch (error: any) {
      console.error("Error exporting sessions:", error);
      toast({
        title: "Export failed",
        description: error.message || "Failed to export session data.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={cn("touch-target", className)}
        >
          <Download className="h-4 w-4 mr-2 flex-shrink-0" />
          <span className="truncate">Export Data</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export Session Data</DialogTitle>
          <DialogDescription>
            Select a date range and export options to download session data as
            CSV.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Start Date */}
          <div className="space-y-2">
            <Label htmlFor="start-date">Start Date</Label>
            <DatePicker
              value={startDate}
              onChange={setStartDate}
              placeholder="Select start date"
              className="w-full"
            />
          </div>

          {/* End Date */}
          <div className="space-y-2">
            <Label htmlFor="end-date">End Date</Label>
            <DatePicker
              value={endDate}
              onChange={setEndDate}
              placeholder="Select end date"
              className="w-full"
            />
          </div>

          {/* Export Options */}
          <div className="space-y-3">
            <Label>Export Options</Label>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-user-data"
                checked={includeUserData}
                onCheckedChange={(checked) =>
                  setIncludeUserData(checked === true)
                }
              />
              <Label htmlFor="include-user-data" className="text-sm">
                Include provider information
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-location-data"
                checked={includeLocationData}
                onCheckedChange={(checked) =>
                  setIncludeLocationData(checked === true)
                }
              />
              <Label htmlFor="include-location-data" className="text-sm">
                Include school information
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="active-only"
                checked={includeActiveOnly}
                onCheckedChange={(checked) =>
                  setIncludeActiveOnly(checked === true)
                }
              />
              <Label htmlFor="active-only" className="text-sm">
                Active sessions only
              </Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
