import Papa from "papaparse";

const ADDRESS_HEADERS = ["address", "street address", "property address", "street", "address line 1", "address1", "site address", "mailing address"];
const UNIT_HEADERS = ["unit", "apt", "apartment", "suite", "unit number", "lot", "address line 2", "address2"];

/** Pulls street (+unit) values out of a CSV. Accepts a header row or a single column of addresses. */
export function parseAddressCsv(csv: string): { row: number; street: string; unit: string }[] {
  const rows = Papa.parse<string[]>(csv.trim(), { skipEmptyLines: true }).data;
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  let streetIdx = header.findIndex((h) => ADDRESS_HEADERS.includes(h));
  if (streetIdx === -1) streetIdx = header.findIndex((h) => h.includes("address") || h.includes("street"));
  const unitIdx = header.findIndex((h) => UNIT_HEADERS.includes(h));
  const hasHeader = streetIdx !== -1 || !/^\d/.test(rows[0][0]?.trim() ?? "");
  if (streetIdx === -1) streetIdx = 0;
  return rows.slice(hasHeader ? 1 : 0).map((r, i) => ({
    row: i + (hasHeader ? 2 : 1),
    street: (r[streetIdx] ?? "").trim(),
    unit: unitIdx >= 0 ? (r[unitIdx] ?? "").trim() : "",
  }));
}

/** Serializes rows to CSV (quotes as needed). */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return Papa.unparse(rows.map((r) => r.map((v) => (v == null ? "" : String(v)))));
}
