import { Session } from "@/lib/firebase/types";

export type CSVRow = Record<
  string,
  string | number | boolean | null | undefined
>;

export function toCSV(rows: CSVRow[], headers?: string[]): string {
  if (!rows.length) return "";
  const headerKeys = headers || Object.keys(rows[0]);
  const escape = (val: any) => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (/[",\n]/.test(str)) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };
  const lines = [headerKeys.join(",")];
  for (const row of rows) {
    lines.push(headerKeys.map((k) => escape(row[k])).join(","));
  }
  return lines.join("\n");
}

export function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Convert an array of Session objects to CSV format
 * @param sessions Array of Session objects to convert
 * @param includeUserData Whether to include user/provider information (requires enriched data)
 * @param includeLocationData Whether to include location/school information (requires enriched data)
 * @returns CSV string with session data
 */
export function sessionsToCSV(
  sessions: (Session & {
    providerName?: string;
    providerEmail?: string;
    locationName?: string;
    locationAddress?: string;
  })[],
  includeUserData = true,
  includeLocationData = true
): string {
  if (!sessions.length) return "";

  const rows: CSVRow[] = sessions.map((session) => {
    const formatDate = (timestamp: any) => {
      if (!timestamp) return "";
      const date =
        timestamp instanceof Date
          ? timestamp
          : timestamp.toDate
          ? timestamp.toDate()
          : new Date(timestamp);
      return date.toLocaleString("en-US", {
        timeZone: "America/Chicago",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    };

    const row: CSVRow = {
      sessionId: session.id || "",
      status: session.status || "",
      startTime: formatDate(session.startTime),
      endTime: formatDate(session.endTime),
      durationMinutes: session.durationMinutes || "",
      durationHours: session.durationMinutes
        ? Math.round((session.durationMinutes / 60) * 100) / 100
        : "",
      checkInMethod: session.checkInMethod || "",
      distanceFromCenter: session.distanceFromCenterAtCheckIn || "",
      dayKey: session.dayKey || "",
      notes: session.notes || "",
    };

    if (includeUserData) {
      row.providerId = session.userId || "";
      row.providerName = session.providerName || "";
      row.providerEmail = session.providerEmail || "";
    }

    if (includeLocationData) {
      row.locationId = session.locationId || "";
      row.locationName = session.locationName || "";
      row.locationAddress = session.locationAddress || "";
    }

    return row;
  });

  // Define custom header order for better readability
  const headers = [
    "sessionId",
    "status",
    "startTime",
    "endTime",
    "durationMinutes",
    "durationHours",
    "checkInMethod",
    "distanceFromCenter",
    "dayKey",
    ...(includeUserData ? ["providerId", "providerName", "providerEmail"] : []),
    ...(includeLocationData
      ? ["locationId", "locationName", "locationAddress"]
      : []),
    "notes",
  ].filter((header) =>
    rows.some((row) => row[header] !== undefined && row[header] !== "")
  );

  return toCSV(rows, headers);
}
