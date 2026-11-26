import { CLASS_OPTIONS } from "@/lib/constants";
import { percent, statusLabel } from "@/utils/format";
import type { ElectionResultRow, ElectionStatus } from "@/types";

/**
 * Spreadsheet helpers for the voter import flow and the results exports: a
 * single election's tally, and the summary of every election the officer ran.
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

/** One election's tally as it appears in the all-election summary. */
export interface ResultsSummarySection {
  meta: ResultsExportMeta;
  rows: ElectionResultRow[];
}

/** Who won the tally, or a note that there is nothing to call. */
function leadingRow(rows: ElectionResultRow[]): { label: string; votes: number } {
  const top = rows.length ? Math.max(...rows.map((row) => Number(row.vote_count))) : 0;
  if (top === 0) return { label: "No votes cast", votes: 0 };

  const leaders = rows.filter((row) => Number(row.vote_count) === top);
  return leaders.length === 1
    ? { label: leaders[0].candidate_name, votes: top }
    : { label: `Tied — ${leaders.map((row) => row.candidate_name).join(", ")}`, votes: top };
}

function summaryGrid(sections: ResultsSummarySection[]): Cell[][] {
  return [
    ["OFKOSSEC — election results summary"],
    [`Generated ${new Date().toLocaleString("en-GB")}`],
    [],
    [
      "Election",
      "Position",
      "Status",
      "Candidates",
      "Ballots cast",
      "Eligible",
      "Turnout %",
      "Winner",
      "Winning votes",
    ],
    ...sections.map(({ meta, rows }) => {
      const winner = leadingRow(rows);
      return [
        meta.title,
        meta.position,
        statusLabel(meta.status),
        rows.length,
        meta.voted,
        meta.eligible,
        meta.eligible ? percent(meta.voted, meta.eligible) : "",
        winner.label,
        winner.votes,
      ];
    }),
  ];
}

const SUMMARY_COLS = [
  { wch: 34 },
  { wch: 26 },
  { wch: 10 },
  { wch: 11 },
  { wch: 13 },
  { wch: 10 },
  { wch: 10 },
  { wch: 30 },
  { wch: 14 },
];

/**
 * Excel will not accept a sheet name longer than 31 characters, containing any
 * of : \ / ? * [ ], or repeated in the same workbook — so titles are trimmed
 * and numbered until they are unique.
 */
function uniqueSheetName(title: string, used: Set<string>): string {
  const base =
    title
      .replace(/[:\\/?*[\]]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 28) || "Election";
  let name = base;
  let attempt = 2;
  while (used.has(name.toLowerCase())) {
    name = `${base.slice(0, 26)} ${attempt++}`;
  }
  used.add(name.toLowerCase());
  return name;
}

/**
 * One workbook for the whole election: an overview sheet with the turnout and
 * the winner of every contest, then each election's full tally on its own sheet.
 */
export async function downloadResultsSummaryXlsx(sections: ResultsSummarySection[]): Promise<void> {
  const XLSX = await import("xlsx");
  const book = XLSX.utils.book_new();

  const overview = XLSX.utils.aoa_to_sheet(summaryGrid(sections));
  overview["!cols"] = SUMMARY_COLS;
  XLSX.utils.book_append_sheet(book, overview, "Summary");

  const used = new Set(["summary"]);
  for (const section of sections) {
    const sheet = XLSX.utils.aoa_to_sheet(resultsGrid(section.rows, section.meta));
    sheet["!cols"] = [{ wch: 6 }, { wch: 28 }, { wch: 22 }, { wch: 10 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(book, sheet, uniqueSheetName(section.meta.title, used));
  }

  XLSX.writeFile(book, resultsFilename("All elections", "xlsx"));
}

function escapeHtml(value: string): string {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  };
  return value.replace(/[&<>"]/g, (char) => entities[char]);
}

/** A4-friendly document: the same summary the workbook carries, ready to sign. */
function resultsSummaryHtml(sections: ResultsSummarySection[]): string {
  const rows = sections
    .map(({ meta, rows: tally }) => {
      const winner = leadingRow(tally);
      return [
        "<tr>",
        `<td>${escapeHtml(meta.title)}</td>`,
        `<td>${escapeHtml(meta.position)}</td>`,
        `<td>${escapeHtml(statusLabel(meta.status))}</td>`,
        `<td class="num">${tally.length}</td>`,
        `<td class="num">${meta.voted}</td>`,
        `<td class="num">${meta.eligible}</td>`,
        `<td class="num">${meta.eligible ? `${percent(meta.voted, meta.eligible)}%` : "—"}</td>`,
        `<td class="winner">${escapeHtml(winner.label)}</td>`,
        `<td class="num">${winner.votes}</td>`,
        "</tr>",
      ].join("");
    })
    .join("\n");

  const details = sections
    .map(({ meta, rows: tally }) => {
      const total = tally.reduce((sum, row) => sum + Number(row.vote_count), 0);
      const body = tally
        .map(
          (row, index) => `<tr>
        <td class="num">${index + 1}</td>
        <td>${escapeHtml(row.candidate_name)}</td>
        <td>${escapeHtml(row.class_name ?? "")}</td>
        <td class="num">${Number(row.vote_count)}</td>
        <td class="num">${percent(Number(row.vote_count), total)}%</td>
      </tr>`,
        )
        .join("\n");

      return `<section>
      <h2>${escapeHtml(meta.title)}</h2>
      <p class="sub">${escapeHtml(meta.position)} · ${escapeHtml(statusLabel(meta.status))} · ${
        meta.voted
      } of ${meta.eligible} voted (${meta.eligible ? `${percent(meta.voted, meta.eligible)}%` : "—"})</p>
      ${
        tally.length === 0
          ? '<p class="sub">No candidates on this ballot.</p>'
          : `<table>
        <thead><tr><th class="num">#</th><th>Candidate</th><th>Class</th><th class="num">Votes</th><th class="num">Share</th></tr></thead>
        <tbody>${body}</tbody>
      </table>`
      }
    </section>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>OFKOSSEC — election results summary</title>
<style>
  body { margin: 28px; color: #16161a; font-family: "Segoe UI", system-ui, sans-serif; font-size: 12px; }
  h1 { margin: 0 0 4px; font-size: 21px; font-weight: 600; }
  h2 { margin: 26px 0 4px; font-size: 15px; font-weight: 600; page-break-after: avoid; }
  p.sub { margin: 0 0 8px; color: #55555f; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; page-break-inside: avoid; }
  th, td { border: 1px solid #d5d5da; padding: 5px 7px; text-align: left; vertical-align: top; }
  th { background: #f1f1f4; font-weight: 600; }
  .num { text-align: right; }
  .winner { font-weight: 600; }
  .toolbar { margin-bottom: 16px; }
  .toolbar button { padding: 7px 14px; border: 1px solid #b9b9c2; border-radius: 6px; background: #fff;
    color: inherit; font: inherit; cursor: pointer; }
  @media print {
    body { margin: 0; }
    .toolbar { display: none; }
    table, section { page-break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="toolbar"><button type="button" onclick="window.print()">Print</button></div>
<h1>OFKOSSEC — election results summary</h1>
<p class="sub">Generated ${escapeHtml(new Date().toLocaleString("en-GB"))}</p>
<table>
  <thead>
    <tr>
      <th>Election</th><th>Position</th><th>Status</th><th class="num">Candidates</th>
      <th class="num">Ballots cast</th><th class="num">Eligible</th><th class="num">Turnout</th>
      <th>Winner</th><th class="num">Winning votes</th>
    </tr>
  </thead>
  <tbody>
${rows}
  </tbody>
</table>
${details}
<script>
  window.addEventListener("load", function () { window.print(); });
</script>
</body>
</html>`;
}

/**
 * Opens the print-ready summary in a new tab; the browser's print dialogue lets
 * the officer print it or save it as a PDF. Returns false when the browser
 * blocked the tab, so the caller can say so.
 */
export function printResultsSummary(sections: ResultsSummarySection[]): boolean {
  const url = URL.createObjectURL(new Blob([resultsSummaryHtml(sections)], { type: "text/html" }));
  const tab = window.open(url, "_blank");

  if (!tab) {
    URL.revokeObjectURL(url);
    return false;
  }

  // The new tab needs the file to still exist while it loads; 60s is ample and
  // the blob is reclaimed even if the officer never closes that tab.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}
