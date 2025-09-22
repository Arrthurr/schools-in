export type CSVRow = Record<string, string | number | boolean | null | undefined>;

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
