import { CLASS_OPTIONS } from "@/lib/constants";
import { percent, statusLabel } from "@/utils/format";
import type { ElectionResultRow, ElectionStatus } from "@/types";

/**
 * Spreadsheet helpers for the voter import flow and the results export.
 *
 * SheetJS is imported on demand so the parser never lands in the main bundle —
 * officers only download it when they actually export or import a file.
 */

export const VOTER_TEMPLATE_FILENAME = "ofkossec-voters-template.xlsx";
export const VOTER_CSV_FILENAME = "ofkossec-voters-template.csv";

/** Value for a file input's `accept` attribute. */
export const SPREADSHEET_ACCEPT = ".xlsx,.xls,.csv,text/csv";

const TEMPLATE_SHEET = "Voters";

/** index number, class, full name, gender — the columns the importer expects. */
const TEMPLATE_ROWS: string[][] = [
  ["Index number", "Class", "Full name", "Gender"],
  ["005017200924", CLASS_OPTIONS[0], "Ama Serwaa", "female"],
  ["005017200925", CLASS_OPTIONS[1], "Kwabena Mensah", "male"],
  ["005017200926", CLASS_OPTIONS[9], "", ""],
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
  sheet["!cols"] = [{ wch: 22 }, { wch: 24 }, { wch: 30 }, { wch: 12 }];

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, TEMPLATE_SHEET);
  XLSX.writeFile(book, VOTER_TEMPLATE_FILENAME);
}

/** Same template as a CSV, for officers who prefer plain text. */
export function downloadVoterTemplateCsv(): void {
  // The BOM keeps Excel from mangling characters when it opens the file.
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

/**
 * Everything the officer needs to identify the contest a tally belongs to,
 * printed above the table so the file stands on its own once it is emailed on.
 */
export interface ResultsExportMeta {
  title: string;
  position: string;
  status: ElectionStatus;
  voted: number;
  eligible: number;
}

type Cell = string | number;

/** Header block plus the ranked tally, shared by the Excel and CSV exports. */
function resultsGrid(rows: ElectionResultRow[], meta: ResultsExportMeta): Cell[][] {
  const total = rows.reduce((sum, row) => sum + Number(row.vote_count), 0);
  return [
    [meta.title],
    [meta.position],
    [
      `Status: ${statusLabel(meta.status)}`,
      `Ballots cast: ${meta.voted}`,
      `Eligible: ${meta.eligible}`,
      `Turnout: ${percent(meta.voted, meta.eligible)}%`,
    ],
    [],
    ["Rank", "Candidate", "Class", "Votes", "Share %"],
    ...rows.map((row, index): Cell[] => [
      index + 1,
      row.candidate_name,
      row.class_name ?? "",
      Number(row.vote_count),
      percent(Number(row.vote_count), total),
    ]),
  ];
}

function resultsFilename(title: string, extension: string): string {
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "election";
  return `ofkossec-${slug}-results.${extension}`;
}

/** Downloads the tally as an Excel workbook. */
export async function downloadResultsXlsx(
  rows: ElectionResultRow[],
  meta: ResultsExportMeta,
): Promise<void> {
  const XLSX = await import("xlsx");
  const sheet = XLSX.utils.aoa_to_sheet(resultsGrid(rows, meta));
  sheet["!cols"] = [{ wch: 6 }, { wch: 28 }, { wch: 22 }, { wch: 10 }, { wch: 10 }];

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Results");
  XLSX.writeFile(book, resultsFilename(meta.title, "xlsx"));
}

/** The same tally as a CSV, for a quick open in any spreadsheet app. */
export function downloadResultsCsv(rows: ElectionResultRow[], meta: ResultsExportMeta): void {
  const csv =
    "\uFEFF" +
    resultsGrid(rows, meta)
      .map((row) =>
        row
          .map((cell) => {
            const text = String(cell ?? "");
            return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
          })
          .join(","),
      )
      .join("\r\n") +
    "\r\n";
  saveBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), resultsFilename(meta.title, "csv"));
}
