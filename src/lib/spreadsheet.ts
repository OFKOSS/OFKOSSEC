import { CLASS_OPTIONS } from "@/lib/constants";

/**
 * Spreadsheet helpers for the voter import flow.
 *
 * SheetJS is imported on demand so the parser never lands in the main bundle —
 * officers only download it when they actually export or import a file.
 */

export const VOTER_TEMPLATE_FILENAME = "ofkossec-voters-template.xlsx";
export const VOTER_CSV_FILENAME = "ofkossec-voters-template.csv";

/** Value for a file input's `accept` attribute. */
export const SPREADSHEET_ACCEPT = ".xlsx,.xls,.csv,text/csv";

const TEMPLATE_SHEET = "Voters";

/** index number, class, full name — the columns the importer expects. */
const TEMPLATE_ROWS: string[][] = [
  ["Index number", "Class", "Full name"],
  ["SHS/2026/0148", CLASS_OPTIONS[8], "Ama Serwaa"],
  ["SHS/2026/0149", CLASS_OPTIONS[9], "Kwabena Mensah"],
  ["SHS/2026/0150", CLASS_OPTIONS[6], ""],
];

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Downloads a real Excel workbook officers can fill in. */
export async function downloadVoterTemplateXlsx(): Promise<void> {
  const XLSX = await import("xlsx");
  const sheet = XLSX.utils.aoa_to_sheet(TEMPLATE_ROWS);
  sheet["!cols"] = [{ wch: 22 }, { wch: 24 }, { wch: 30 }];

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, TEMPLATE_SHEET);
  XLSX.writeFile(book, VOTER_TEMPLATE_FILENAME);
}

/** Same template as a CSV, for officers who prefer plain text. */
export function downloadVoterTemplateCsv(): void {
  // Excel only keeps the em dash in the class names when the BOM is present.
  const csv = "\uFEFF" + TEMPLATE_ROWS.map((row) => row.join(",")).join("\r\n") + "\r\n";
  saveBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), VOTER_CSV_FILENAME);
}

/**
 * Reads the first sheet of an .xlsx / .xls / .csv file into a grid of trimmed
 * strings. Blank rows are dropped.
 */
export async function readSpreadsheetRows(file: File): Promise<string[][]> {
  const XLSX = await import("xlsx");

  const isCsv = /\.csv$/i.test(file.name) || file.type === "text/csv";
  const book = isCsv
    ? XLSX.read(await file.text(), { type: "string" })
    : XLSX.read(await file.arrayBuffer(), { type: "array" });

  const sheetName = book.SheetNames[0];
  if (!sheetName) return [];

  const grid = XLSX.utils.sheet_to_json(book.Sheets[sheetName], {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  }) as unknown[][];

  return grid.map((row) => row.map((cell) => String(cell ?? "").trim()));
}
