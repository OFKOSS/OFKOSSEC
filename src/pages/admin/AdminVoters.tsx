import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Download,
  FileSpreadsheet,
  FileUp,
  GraduationCap,
  IdCard,
  Layers,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { AppShell, PageHeading } from "@/components/layout/AppShell";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Field, Input, Select, TextArea } from "@/components/ui/Field";
import { Alert, EmptyState, PageLoader, Spinner } from "@/components/ui/Feedback";
import { Modal } from "@/components/ui/Modal";
import { StatTile } from "@/components/admin/StatTile";
import { supabase } from "@/lib/supabase";
import { CLASS_OPTIONS } from "@/lib/constants";
import { useClasses } from "@/hooks/useClasses";
import { isUsableIndexNumber, normalizeIndexNumber } from "@/lib/voterAuth";
import {
  SPREADSHEET_ACCEPT,
  downloadVoterTemplateCsv,
  downloadVoterTemplateXlsx,
  readSpreadsheetRows,
} from "@/lib/spreadsheet";
import { cn } from "@/lib/utils";
import { formatDate, pluralise } from "@/utils/format";
import type { Profile } from "@/types";

interface BulkProblem {
  line: number;
  text: string;
  reason: string;
}

interface BulkRow {
  index: string;
  className: string;
  name: string;
}

/** Split one pasted row and tidy up Excel's padding and quotes. */
function splitRow(line: string): string[] {
  const parts = line.includes(",") ? line.split(",") : line.split("\t");
  return parts.map((part) => part.trim().replace(/^"(.*)"$/, "$1").trim());
}

/**
 * Validate a grid of cells — one voter per row, columns:
 * index number, class, full name (name optional).
 * Shared by the paste box and by uploaded .xlsx / .csv files.
 * The class list comes from the database, so a renamed class validates.
 */
function parseVoterRows(
  grid: string[][],
  classList: string[],
): { rows: BulkRow[]; problems: BulkProblem[] } {
  const rows: BulkRow[] = [];
  const problems: BulkProblem[] = [];
  const seen = new Set<string>();

  grid.forEach((cells, index) => {
    const lineNo = index + 1;
    const parts = cells.map((cell) => cell.trim());
    if (parts.every((part) => !part)) return; // blank row

    const indexNumber = parts[0] ?? "";

    // Ignore the header row of the downloadable template.
    if (index === 0 && /^(index(\s*number)?|student\s*id)$/i.test(indexNumber)) return;

    const className = parts[1] ?? "";
    const fullName = parts.slice(2).join(", ").trim();

    if (!indexNumber || !className) {
      problems.push({
        line: lineNo,
        text: parts.join(", "),
        reason: "Use: index number, class, full name",
      });
      return;
    }
    if (!isUsableIndexNumber(indexNumber)) {
      problems.push({
        line: lineNo,
        text: parts.join(", "),
        reason: "That index number cannot be used as a login",
      });
      return;
    }
    if (!classList.includes(className)) {
      problems.push({
        line: lineNo,
        text: parts.join(", "),
        reason: `Unknown class "${className}" — it must match the class list exactly`,
      });
      return;
    }

    const key = normalizeIndexNumber(indexNumber);
    if (seen.has(key)) {
      problems.push({ line: lineNo, text: parts.join(", "), reason: "Duplicate of an earlier line" });
      return;
    }

    seen.add(key);
    rows.push({ index: indexNumber, className, name: fullName });
  });

  return { rows, problems };
}

/** Turn pasted text into a grid, then reuse the same validation. */
function parseBulkInput(text: string, classList: string[]) {
  const grid = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => (line.trim() ? splitRow(line) : []));
  return parseVoterRows(grid, classList);
}

interface PendingImport {
  source: string;
  rows: BulkRow[];
  problems: BulkProblem[];
}

export default function AdminVoters() {
  const [voters, setVoters] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [indexNumber, setIndexNumber] = useState("");
  const [className, setClassName] = useState(CLASS_OPTIONS[0]);
  const [fullName, setFullName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);

  const [bulkText, setBulkText] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [readingFile, setReadingFile] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [bulkReport, setBulkReport] = useState<
    { created: number; updated: number; source: string; problems: BulkProblem[] } | null
  >(null);

  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [pendingRemoval, setPendingRemoval] = useState<Profile | null>(null);
  const [removing, setRemoving] = useState(false);

  const [editing, setEditing] = useState<Profile | null>(null);
  const [editIndex, setEditIndex] = useState("");
  const [editClass, setEditClass] = useState(CLASS_OPTIONS[0]);
  const [editName, setEditName] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editNotice, setEditNotice] = useState<string | null>(null);

  // Managing classes: add, rename, and empty a whole class at once.
  const { classes, reload: reloadClasses } = useClasses();
  const [newClassName, setNewClassName] = useState("");
  const [classBusy, setClassBusy] = useState(false);
  const [classError, setClassError] = useState<string | null>(null);
  const [classNotice, setClassNotice] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [pendingClassRemoval, setPendingClassRemoval] = useState<string | null>(null);
  const [pendingClassDelete, setPendingClassDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "student")
      .order("created_at", { ascending: false });

    if (error) {
      setLoadError(error.message);
    } else {
      setVoters((data as Profile[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const classesInUse = useMemo(
    () => new Set(voters.map((voter) => voter.class_name).filter(Boolean)).size,
    [voters],
  );

  /** How many voters sit in each class — what a bulk removal would take out. */
  const classCounts = useMemo(() => {
    const counts = new Map<string, number>();
    voters.forEach((voter) => {
      if (!voter.class_name) return;
      counts.set(voter.class_name, (counts.get(voter.class_name) ?? 0) + 1);
    });
    return counts;
  }, [voters]);

  /**
   * The officer's class list, plus any class already on the register. A roster
   * imported before migration 013 could name a class the list has never heard
   * of, and those voters still have to be manageable.
   */
  const allClasses = useMemo(() => {
    const merged = [...classes];
    const known = new Set(classes);
    voters.forEach((voter) => {
      const name = voter.class_name;
      if (name && !known.has(name)) {
        known.add(name);
        merged.push(name);
      }
    });
    return merged;
  }, [classes, voters]);

  // Keep the add-voter dropdown on a class that still exists, in case the
  // officer renamed or removed the one we started on.
  useEffect(() => {
    if (allClasses.length > 0 && !allClasses.includes(className)) setClassName(allClasses[0]);
  }, [allClasses, className]);

  /** Existing voters keyed by normalised index number, used to upsert on import. */
  const existingByIndex = useMemo(() => {
    const map = new Map<string, Profile>();
    voters.forEach((voter) => {
      if (voter.student_id) map.set(normalizeIndexNumber(voter.student_id), voter);
    });
    return map;
  }, [voters]);

  /** What the pending file will change, shown before the officer confirms. */
  const pendingBreakdown = useMemo(() => {
    if (!pendingImport) return null;
    let added = 0;
    let updated = 0;
    pendingImport.rows.forEach((row) => {
      if (existingByIndex.has(normalizeIndexNumber(row.index))) updated += 1;
      else added += 1;
    });
    return { added, updated };
  }, [pendingImport, existingByIndex]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return voters.filter((voter) => {
      if (classFilter !== "all" && voter.class_name !== classFilter) return false;
      if (!needle) return true;
      return (
        (voter.student_id ?? "").toLowerCase().includes(needle) ||
        voter.full_name.toLowerCase().includes(needle)
      );
    });
  }, [voters, query, classFilter]);

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    setAddError(null);
    setAddSuccess(null);

    if (!indexNumber.trim()) return setAddError("Enter the student's index number.");
    if (!isUsableIndexNumber(indexNumber)) {
      return setAddError("That index number cannot be used as a login.");
    }

    setAdding(true);
    const { error } = await supabase.rpc("admin_create_voter", {
      p_index_number: indexNumber.trim(),
      p_class_name: className,
      p_full_name: fullName.trim() || null,
    });
    setAdding(false);

    if (error) {
      setAddError(error.message);
      return;
    }

    setAddSuccess(
      `${indexNumber.trim()} added. They sign in with index number ${indexNumber.trim()} and class ${className}.`,
    );
    setIndexNumber("");
    setFullName("");
    await load();
  };

  /**
   * Creates or updates every valid row and reports the lines that failed.
   * Re-uploading a list overwrites students already on the register instead of
   * rejecting them; an import never removes anyone.
   */
  const createVoters = async (rows: BulkRow[], problems: BulkProblem[], source: string) => {
    if (rows.length === 0) {
      setBulkReport({ created: 0, updated: 0, source, problems });
      setPendingImport(null);
      return;
    }

    setBulkBusy(true);

    const results = await Promise.all(
      rows.map(async (row) => {
        const match = existingByIndex.get(normalizeIndexNumber(row.index));
        const { error } = match
          ? await supabase.rpc("admin_update_voter", {
              p_voter_id: match.id,
              p_index_number: row.index,
              p_class_name: row.className,
              p_full_name: row.name || null,
            })
          : await supabase.rpc("admin_create_voter", {
              p_index_number: row.index,
              p_class_name: row.className,
              p_full_name: row.name || null,
            });
        return { row, updated: Boolean(match), error: error?.message ?? null };
      }),
    );

    const failures: BulkProblem[] = results
      .map((result, index) => ({ result, index }))
      .filter(({ result }) => result.error)
      .map(({ result, index }) => ({
        line: index + 1,
        text: `${result.row.index}, ${result.row.className}${result.row.name ? `, ${result.row.name}` : ""}`,
        reason: result.error as string,
      }));

    const succeeded = results.filter((result) => !result.error);
    const updated = succeeded.filter((result) => result.updated).length;
    const created = succeeded.length - updated;

    setBulkBusy(false);
    setBulkReport({ created, updated, source, problems: [...problems, ...failures] });
    setPendingImport(null);
    if (succeeded.length > 0) {
      setBulkText("");
      await load();
    }
  };

  /** Paste box → validate, then import straight away. */
  const handlePasteImport = async () => {
    const { rows, problems } = parseBulkInput(bulkText, allClasses);
    await createVoters(rows, problems, "the pasted rows");
  };

  /** Uploaded .xlsx / .csv → validate and show a confirmation before importing. */
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // let the same file be picked again
    if (!file) return;

    setBulkReport(null);
    setImportError(null);
    setReadingFile(true);

    try {
      const grid = await readSpreadsheetRows(file);
      const { rows, problems } = parseVoterRows(grid, allClasses);

      if (rows.length === 0 && problems.length === 0) {
        setImportError("That file looks empty. Use the template and try again.");
      } else {
        setPendingImport({ source: file.name, rows, problems });
      }
    } catch {
      setImportError("We could not read that file. Save it as .xlsx or .csv and try again.");
    } finally {
      setReadingFile(false);
    }
  };

  const confirmRemoval = async () => {
    if (!pendingRemoval) return;
    setRemoving(true);
    const { error } = await supabase.rpc("admin_delete_voter", { p_voter_id: pendingRemoval.id });
    setRemoving(false);

    if (error) {
      setLoadError(error.message);
      setPendingRemoval(null);
      return;
    }

    setPendingRemoval(null);
    await load();
  };

  /** Opens the edit dialog with the voter's current details. */
  const startEdit = (voter: Profile) => {
    setEditing(voter);
    setEditIndex(voter.student_id ?? "");
    setEditClass(voter.class_name ?? allClasses[0] ?? CLASS_OPTIONS[0]);
    setEditName(voter.full_name);
    setEditError(null);
  };

  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    setEditError(null);

    if (!editIndex.trim()) return setEditError("Enter the student's index number.");
    if (!isUsableIndexNumber(editIndex)) {
      return setEditError("That index number cannot be used as a login.");
    }

    setEditBusy(true);
    const { error } = await supabase.rpc("admin_update_voter", {
      p_voter_id: editing.id,
      p_index_number: editIndex.trim(),
      p_class_name: editClass,
      p_full_name: editName.trim() || null,
    });
    setEditBusy(false);

    if (error) {
      setEditError(error.message);
      return;
    }

    setEditNotice(
      `Saved. ${editIndex.trim()} now signs in with index number ${editIndex.trim()} and class ${editClass}.`,
    );
    setEditing(null);
    await load();
  };

  /** Adds a class to the officer's list. Existing students are never moved. */
  const handleAddClass = async (event: React.FormEvent) => {
    event.preventDefault();
    setClassError(null);
    setClassNotice(null);

    const name = newClassName.trim();
    if (!name) {
      setClassError("Enter a class name.");
      return;
    }

    setClassBusy(true);
    const { error } = await supabase.rpc("admin_add_class", { p_name: name });
    setClassBusy(false);

    if (error) {
      setClassError(error.message);
      return;
    }

    setNewClassName("");
    setClassNotice(`Added ${name} to the class list.`);
    await reloadClasses();
  };

  const startRenameClass = (name: string) => {
    setRenaming(name);
    setRenameValue(name);
    setRenameError(null);
    setClassError(null);
    setClassNotice(null);
  };

  /**
   * Renaming moves every student in the class and changes the class they sign in
   * with, because the class name is their password.
   */
  const saveRenameClass = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!renaming) return;

    const next = renameValue.trim();
    if (!next) {
      setRenameError("Enter a class name.");
      return;
    }

    setRenameError(null);
    setClassBusy(true);
    const { data, error } = await supabase.rpc("admin_rename_class", {
      p_old_name: renaming,
      p_new_name: next,
    });
    setClassBusy(false);

    if (error) {
      setRenameError(error.message);
      return;
    }

    const moved = Number(data ?? 0);
    setClassNotice(
      `Renamed ${renaming} to ${next}. ${pluralise(moved, "voter")} updated — they now sign in with ${next}.`,
    );
    setRenaming(null);
    await Promise.all([load(), reloadClasses()]);
  };

  /** Removes every voter in a class in one call. */
  const confirmClassRemoval = async () => {
    if (!pendingClassRemoval) return;
    const target = pendingClassRemoval;

    setClassBusy(true);
    const { data, error } = await supabase.rpc("admin_delete_voters_by_class", {
      p_class_name: target,
    });
    setClassBusy(false);
    setPendingClassRemoval(null);

    if (error) {
      setClassError(error.message);
      return;
    }

    setClassError(null);
    setClassNotice(`Removed ${pluralise(Number(data ?? 0), "voter")} from ${target}.`);
    await load();
  };

  /** Takes a class off the list. Only possible once it is empty. */
  const confirmClassDelete = async () => {
    if (!pendingClassDelete) return;
    const target = pendingClassDelete;

    setClassBusy(true);
    const { error } = await supabase.rpc("admin_delete_class", { p_name: target });
    setClassBusy(false);
    setPendingClassDelete(null);

    if (error) {
      setClassError(error.message);
      return;
    }

    setClassError(null);
    setClassNotice(`Removed the empty class ${target} from the list.`);
    await Promise.all([load(), reloadClasses()]);
  };

  return (
    <AppShell>
      <div className="container max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
        <Link
          to="/admin"
          className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.1em] text-on-surface-variant transition-colors hover:text-on-surface"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.2} />
          Officer panel
        </Link>

        <div className="mt-6">
          <PageHeading
            eyebrow="Voter register"
            title="Who can vote"
            description="Add each student once. Their index number is the login name and their class is the password."
            actions={
              <Button
                variant="outline"
                size="md"
                onClick={() => void downloadVoterTemplateXlsx()}
                icon={<Download className="h-4 w-4" strokeWidth={2.4} />}
              >
                Download Excel template
              </Button>
            }
          />
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <StatTile
            label="Registered voters"
            value={voters.length}
            icon={<Users className="h-4 w-4" strokeWidth={2.2} />}
            accent="poppy"
          />
          <StatTile
            label="Classes covered"
            value={classesInUse}
            icon={<Layers className="h-4 w-4" strokeWidth={2.2} />}
            accent="cobalt"
          />
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1fr]">
          <section className="rounded-[28px] border border-outline-variant bg-surface-container-low p-6 shadow-elev-2 sm:p-7">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant bg-primary-container text-on-primary-container shadow-elev-1">
                <UserPlus className="h-4 w-4" strokeWidth={2.2} />
              </span>
              <h2 className="text-2xl font-normal text-on-surface">Add one voter</h2>
            </div>

            <form onSubmit={handleAdd} className="mt-6 flex flex-col gap-5">
              {addError && <Alert>{addError}</Alert>}
              {addSuccess && <Alert tone="success">{addSuccess}</Alert>}

              <Field label="Index number" htmlFor="voter-index" required hint="Index number, then the year.">
                <Input
                  id="voter-index"
                  name="voter-index"
                  value={indexNumber}
                  onChange={(event) => setIndexNumber(event.target.value)}
                  placeholder="Index number and year e.g. 005017200924"
                  maxLength={40}
                  autoCapitalize="characters"
                />
              </Field>

              <Field label="Class" htmlFor="voter-class" required hint="This becomes their password.">
                <Select
                  id="voter-class"
                  name="voter-class"
                  value={className}
                  onChange={(event) => setClassName(event.target.value)}
                >
                  {allClasses.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Full name" htmlFor="voter-name" hint="Optional — helps you keep the register readable.">
                <Input
                  id="voter-name"
                  name="voter-name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Ama Serwaa"
                  maxLength={80}
                />
              </Field>

              <Button type="submit" size="lg" disabled={adding} className="w-full">
                <Plus className="h-4 w-4" strokeWidth={2.6} />
                {adding ? "Adding…" : "Add voter"}
              </Button>
            </form>
          </section>

          <section
            id="import"
            className="rounded-[28px] border border-outline-variant bg-surface-container-low p-6 shadow-elev-2 sm:p-7"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant bg-tertiary-container text-on-tertiary-container shadow-elev-1">
                <FileSpreadsheet className="h-4 w-4" strokeWidth={2.2} />
              </span>
              <h2 className="text-2xl font-normal text-on-surface">Add a whole class</h2>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
              Fill the Excel template, then upload it here. One voter per row:{" "}
              <span className="font-mono text-xs">index number</span>,{" "}
              <span className="font-mono text-xs">class</span>,{" "}
              <span className="font-mono text-xs">full name</span>. Re-uploading updates students
              already on the register — it never removes anyone.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                variant="cobalt"
                size="sm"
                onClick={() => void downloadVoterTemplateXlsx()}
                icon={<FileSpreadsheet className="h-4 w-4" strokeWidth={2.4} />}
              >
                Excel template (.xlsx)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadVoterTemplateCsv}
                icon={<Download className="h-4 w-4" strokeWidth={2.4} />}
              >
                CSV template
              </Button>
              <label
                className={buttonClasses(
                  "outline",
                  "sm",
                  readingFile ? "pointer-events-none opacity-50" : "cursor-pointer",
                )}
              >
                {readingFile ? <Spinner /> : <FileUp className="h-4 w-4" strokeWidth={2.4} />}
                {readingFile ? "Reading…" : "Upload filled sheet"}
                <input
                  type="file"
                  accept={SPREADSHEET_ACCEPT}
                  onChange={(event) => void handleFileUpload(event)}
                  className="sr-only"
                />
              </label>
            </div>

            {importError && (
              <div className="mt-4">
                <Alert>{importError}</Alert>
              </div>
            )}

            {pendingImport && (
              <div className="mt-5 rounded-2xl border border-outline-variant bg-surface-container p-4 shadow-elev-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-on-surface-variant">
                  Ready to import
                </p>
                <p className="mt-1.5 text-sm text-on-surface">
                  <span className="font-medium">{pluralise(pendingImport.rows.length, "voter")}</span> found in{" "}
                  <span className="font-mono text-xs">{pendingImport.source}</span>
                </p>
                {pendingBreakdown && (
                  <p className="mt-1 text-xs text-on-surface-variant">
                    {pendingBreakdown.added} new · {pendingBreakdown.updated} updated
                  </p>
                )}

                {pendingImport.rows.length > 0 && (
                  <ul className="mt-3 flex max-h-40 flex-col gap-1 overflow-y-auto text-xs text-on-surface-variant">
                    {pendingImport.rows.slice(0, 50).map((row) => (
                      <li key={row.index} className="font-mono">
                        {row.index} · {row.className}
                        {row.name ? ` · ${row.name}` : ""}
                      </li>
                    ))}
                    {pendingImport.rows.length > 50 && (
                      <li>… and {pendingImport.rows.length - 50} more</li>
                    )}
                  </ul>
                )}

                {pendingImport.problems.length > 0 && (
                  <div className="mt-3 rounded-2xl bg-error-container p-3 text-xs text-on-error-container">
                    <p className="font-medium">
                      {pluralise(pendingImport.problems.length, "row")} will be skipped
                    </p>
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {pendingImport.problems.map((problem, index) => (
                        <li key={`${problem.line}-${index}`}>
                          <span className="font-mono">{problem.text || `line ${problem.line}`}</span> —{" "}
                          {problem.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button
                    size="sm"
                    disabled={bulkBusy || pendingImport.rows.length === 0}
                    onClick={() =>
                      void createVoters(
                        pendingImport.rows,
                        pendingImport.problems,
                        pendingImport.source,
                      )
                    }
                    icon={<Upload className="h-4 w-4" strokeWidth={2.4} />}
                  >
                    {bulkBusy ? "Adding…" : `Import ${pluralise(pendingImport.rows.length, "voter")}`}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="border border-outline-variant"
                    disabled={bulkBusy}
                    onClick={() => setPendingImport(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <div className="mt-6 border-t border-dashed border-outline-variant pt-5">
              <Field
                label="Or paste the rows"
                htmlFor="bulk-voters"
                hint="Straight out of Excel or Sheets — tab or comma separated."
              >
                <TextArea
                  id="bulk-voters"
                  name="bulk-voters"
                  rows={6}
                  value={bulkText}
                  onChange={(event) => setBulkText(event.target.value)}
                  placeholder={"Index number, Class, Full name\n005017200924, 3A1, Ama Serwaa\n005017200925, 3A1, Kwabena Mensah"}
                  className="font-mono text-xs"
                />
              </Field>

              <Button
                variant="outline"
                size="md"
                className="mt-4"
                disabled={bulkBusy || !bulkText.trim()}
                onClick={() => void handlePasteImport()}
                icon={<Upload className="h-4 w-4" strokeWidth={2.4} />}
              >
                {bulkBusy ? "Adding…" : "Add pasted rows"}
              </Button>
            </div>

            {bulkReport && (
              <div className="mt-5 flex flex-col gap-3">
                {bulkReport.created > 0 && (
                  <Alert tone="success">
                    Added {pluralise(bulkReport.created, "voter")} from {bulkReport.source}.
                  </Alert>
                )}
                {bulkReport.updated > 0 && (
                  <Alert tone="success">
                    Updated {pluralise(bulkReport.updated, "voter")} already on the register.
                  </Alert>
                )}
                {bulkReport.problems.length > 0 && (
                  <div className="rounded-2xl bg-error-container p-3.5 text-on-error-container">
                    <p className="text-[11px] font-medium uppercase tracking-[0.1em]">
                      {pluralise(bulkReport.problems.length, "row")} skipped
                    </p>
                    <ul className="mt-2.5 flex flex-col gap-1.5 text-xs">
                      {bulkReport.problems.map((problem, index) => (
                        <li key={`${problem.line}-${index}`}>
                          <span className="font-mono">{problem.text || `line ${problem.line}`}</span> —{" "}
                          {problem.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {bulkReport.created === 0 &&
                  bulkReport.updated === 0 &&
                  bulkReport.problems.length === 0 && (
                    <Alert tone="info">Nothing to add — there were no rows.</Alert>
                  )}
              </div>
            )}
          </section>
        </div>

        <section className="mt-8 rounded-[28px] border border-outline-variant bg-surface-container p-6 shadow-elev-2 sm:p-7">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant bg-tertiary-container text-on-tertiary-container shadow-elev-1">
              <Layers className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <h2 className="text-2xl font-normal text-on-surface">Classes</h2>
          </div>

          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-on-surface-variant">
            The class is also the password, so renaming one moves every student in it and changes what
            they sign in with. The list students choose from on the sign-in page follows this list.
          </p>

          {(classError || classNotice) && (
            <div className="mt-5">
              {classError ? <Alert>{classError}</Alert> : <Alert tone="success">{classNotice}</Alert>}
            </div>
          )}

          <ul className="mt-5 flex flex-col gap-2.5">
            {allClasses.map((name) => {
              const count = classCounts.get(name) ?? 0;
              return (
                <li
                  key={name}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3 shadow-elev-1"
                >
                  <div className="flex min-w-0 items-center gap-3.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-surface-container">
                      <GraduationCap className="h-4 w-4 text-tertiary" strokeWidth={2.2} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-mono text-lg font-normal leading-tight text-on-surface">
                        {name}
                      </p>
                      <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.1em] text-on-surface-variant">
                        {count === 0 ? "No voters in this class" : pluralise(count, "voter")}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startRenameClass(name)}
                      icon={<Pencil className="h-3.5 w-3.5" strokeWidth={2.4} />}
                    >
                      Rename
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="border border-outline-variant"
                      disabled={count === 0}
                      onClick={() => setPendingClassRemoval(name)}
                      icon={<Trash2 className="h-3.5 w-3.5" strokeWidth={2.4} />}
                    >
                      Remove all voters
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="border border-outline-variant"
                      disabled={count > 0}
                      onClick={() => setPendingClassDelete(name)}
                      icon={<X className="h-3.5 w-3.5" strokeWidth={2.4} />}
                    >
                      Delete class
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>

          <form
            onSubmit={handleAddClass}
            className="mt-6 flex flex-wrap items-end gap-3 border-t border-dashed border-outline-variant pt-5"
          >
            <Field
              label="Add a class"
              htmlFor="new-class"
              className="min-w-[12rem] max-w-xs flex-1"
              hint="It appears in the class list straight away."
            >
              <Input
                id="new-class"
                name="new-class"
                value={newClassName}
                onChange={(event) => setNewClassName(event.target.value)}
                placeholder="e.g. 1A1"
                maxLength={40}
              />
            </Field>
            <Button
              type="submit"
              variant="cobalt"
              size="md"
              disabled={classBusy || !newClassName.trim()}
              icon={<Plus className="h-4 w-4" strokeWidth={2.6} />}
            >
              {classBusy ? "Saving…" : "Add class"}
            </Button>
          </form>
        </section>

        <section className="mt-8 rounded-[28px] border border-outline-variant bg-surface-container p-6 sm:p-7">
          <h2 className="flex items-center gap-2.5 text-2xl font-normal text-on-surface">
            <ClipboardList className="h-5 w-5" strokeWidth={2.2} />
            How students sign in
          </h2>
          <ol className="mt-5 grid gap-4 md:grid-cols-2">
            {[
              { step: "01", body: "Students open the sign-in page and stay on the Student tab." },
              { step: "02", body: "They type their index number exactly as you entered it here." },
              { step: "03", body: "They pick their class from the list — the class is the password." },
              { step: "04", body: "They read the manifestos and cast one secret ballot per election." },
            ].map((item) => (
              <li
                key={item.step}
                className="flex gap-3.5 rounded-2xl border border-outline-variant bg-surface-container-low p-4 shadow-elev-1"
              >
                <span className="font-mono text-sm font-medium text-primary">{item.step}</span>
                <span className="text-sm leading-relaxed text-on-surface-variant">{item.body}</span>
              </li>
            ))}
          </ol>
          <p className="mt-5 flex items-start gap-2 border-t border-dashed border-outline-variant pt-4 text-xs leading-relaxed text-on-surface-variant">
            <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-tertiary" strokeWidth={2.2} />
            Because the class is the password, anyone who knows a student&apos;s index number and class
            could sign in as them. Keep index numbers off public notice boards and remove voters who
            leave.
          </p>
        </section>

        {editNotice && (
          <div className="mt-8">
            <Alert tone="success">{editNotice}</Alert>
          </div>
        )}

        {loadError && (
          <div className="mt-8">
            <Alert>{loadError}</Alert>
          </div>
        )}

        <section className="mt-12">
          <div className="mb-5 flex flex-col gap-4 border-b border-outline-variant pb-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-normal text-on-surface">On the register</h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                {loading ? "Loading…" : `${pluralise(visible.length, "voter")} shown`}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Select
                aria-label="Filter by class"
                name="class-filter"
                value={classFilter}
                onChange={(event) => setClassFilter(event.target.value)}
                className="sm:w-52"
              >
                <option value="all">All classes</option>
                {allClasses.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>

              <div className="relative sm:w-64">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant"
                  strokeWidth={2.2}
                />
                <input
                  id="voter-search"
                  name="voter-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search index or name…"
                  aria-label="Search voters"
                  className="w-full rounded-lg border border-outline bg-transparent py-2.5 pl-9 pr-9 font-sans text-sm text-on-surface transition-colors placeholder:text-on-surface-variant/60 hover:border-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant transition-colors hover:text-on-surface"
                  >
                    <X className="h-4 w-4" strokeWidth={2.4} />
                  </button>
                )}
              </div>

              {classFilter !== "all" && (
                <Button
                  variant="ghost"
                  size="md"
                  className="border border-outline-variant"
                  disabled={classBusy || (classCounts.get(classFilter) ?? 0) === 0}
                  onClick={() => setPendingClassRemoval(classFilter)}
                  icon={<Trash2 className="h-4 w-4" strokeWidth={2.4} />}
                >
                  Remove all in {classFilter}
                </Button>
              )}
            </div>
          </div>

          {loading ? (
            <PageLoader label="Loading the register" />
          ) : voters.length === 0 ? (
            <EmptyState
              icon={<IdCard className="h-6 w-6" strokeWidth={2.2} />}
              title="No voters registered yet"
              description="Add students above, or import a whole class from the Excel template. Until they are on this list they cannot sign in to vote."
            />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<Search className="h-6 w-6" strokeWidth={2.2} />}
              title="No voters match"
              description="Try a different class filter or clear your search."
              action={
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setClassFilter("all");
                  }}
                  className={buttonClasses("outline", "md")}
                >
                  Clear filters
                </button>
              }
            />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {visible.map((voter) => (
                <li
                  key={voter.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3 shadow-elev-1"
                >
                  <div className="flex min-w-0 items-center gap-3.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-surface-container font-mono text-[11px] font-medium">
                      {(voter.student_id ?? "?").slice(-2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-lg font-normal text-on-surface leading-tight">
                        {voter.full_name}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium uppercase tracking-[0.1em] text-on-surface-variant">
                        <span className="inline-flex items-center gap-1 font-mono">
                          <IdCard className="h-3.5 w-3.5" strokeWidth={2.2} />
                          {voter.student_id ?? "no index"}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1",
                            voter.class_name ? "text-tertiary" : "text-primary",
                          )}
                        >
                          <GraduationCap className="h-3.5 w-3.5" strokeWidth={2.2} />
                          {voter.class_name ?? "no class"}
                        </span>
                        <span className="text-on-surface-variant">Added {formatDate(voter.created_at)}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(voter)}
                      className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container-low px-3 py-2 text-[11px] font-medium uppercase tracking-[0.1em] text-on-surface-variant shadow-elev-1 transition-colors hover:bg-primary hover:text-on-primary active:bg-primary/80"
                    >
                      <Pencil className="h-3.5 w-3.5" strokeWidth={2.4} />
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => setPendingRemoval(voter)}
                      className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container-low px-3 py-2 text-[11px] font-medium uppercase tracking-[0.1em] text-on-surface-variant shadow-elev-1 transition-colors hover:bg-error hover:text-on-error active:bg-error/80"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={2.4} />
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {!loading && voters.length > 0 && (
            <p className="mt-6 flex items-center justify-center gap-2 text-center text-[11px] font-medium uppercase tracking-[0.1em] text-on-surface-variant">
              <CheckCircle2 className="h-4 w-4" strokeWidth={2.2} />
              Every voter can cast exactly one ballot per election
            </p>
          )}
        </section>
      </div>

      <Modal
        open={Boolean(editing)}
        title="Edit voter"
        onClose={() => (editBusy ? undefined : setEditing(null))}
        footer={
          <>
            <Button
              variant="ghost"
              className="border border-outline-variant"
              onClick={() => setEditing(null)}
              disabled={editBusy}
            >
              Cancel
            </Button>
            <Button type="submit" form="edit-voter-form" disabled={editBusy}>
              {editBusy ? "Saving…" : "Save changes"}
            </Button>
          </>
        }
      >
        <form id="edit-voter-form" onSubmit={saveEdit} className="flex flex-col gap-5">
          {editError && <Alert>{editError}</Alert>}

          <Field
            label="Index number"
            htmlFor="edit-voter-index"
            required
            hint="This is their login name."
          >
            <Input
              id="edit-voter-index"
              name="edit-voter-index"
              value={editIndex}
              onChange={(event) => setEditIndex(event.target.value)}
              placeholder="Index number and year e.g. 005017200924"
              maxLength={40}
              autoCapitalize="characters"
            />
          </Field>

          <Field
            label="Class"
            htmlFor="edit-voter-class"
            required
            hint="This is also their password, so changing it changes how they sign in."
          >
            <Select
              id="edit-voter-class"
              name="edit-voter-class"
              value={editClass}
              onChange={(event) => setEditClass(event.target.value)}
            >
              {CLASS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Full name" htmlFor="edit-voter-name" hint="Optional.">
            <Input
              id="edit-voter-name"
              name="edit-voter-name"
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
              placeholder="Ama Serwaa"
              maxLength={80}
            />
          </Field>

          <p className="border-t border-dashed border-outline-variant pt-4 text-xs leading-relaxed text-on-surface-variant">
            Their existing ballot stays as it is. Only the details they sign in with change.
          </p>
        </form>
      </Modal>

      <Modal
        open={Boolean(pendingRemoval)}
        title="Remove this voter?"
        onClose={() => (removing ? undefined : setPendingRemoval(null))}
        footer={
          <>
            <Button
              variant="ghost"
              className="border border-outline-variant"
              onClick={() => setPendingRemoval(null)}
              disabled={removing}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void confirmRemoval()} disabled={removing}>
              {removing ? "Removing…" : "Yes, remove"}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-on-surface-variant">
          <strong className="text-on-surface">{pendingRemoval?.full_name}</strong> will lose access immediately.
        </p>
        <p className="mt-4 border-t border-dashed border-outline-variant pt-4 text-xs leading-relaxed text-on-surface-variant">
          Any ballot they already cast is anonymous and stays in the count. This cannot be undone.
        </p>
      </Modal>

      <Modal
        open={Boolean(renaming)}
        title="Rename this class?"
        onClose={() => (classBusy ? undefined : setRenaming(null))}
        footer={
          <>
            <Button
              variant="ghost"
              className="border border-outline-variant"
              onClick={() => setRenaming(null)}
              disabled={classBusy}
            >
              Cancel
            </Button>
            <Button type="submit" form="rename-class-form" disabled={classBusy}>
              {classBusy ? "Renaming…" : "Rename class"}
            </Button>
          </>
        }
      >
        <form id="rename-class-form" onSubmit={saveRenameClass} className="flex flex-col gap-5">
          {renameError && <Alert>{renameError}</Alert>}

          <Field
            label="New class name"
            htmlFor="rename-class"
            required
            hint="Students will pick this instead of the old name."
          >
            <Input
              id="rename-class"
              name="rename-class"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              maxLength={40}
            />
          </Field>

          <p className="border-t border-dashed border-outline-variant pt-4 text-xs leading-relaxed text-on-surface-variant">
            {pluralise(classCounts.get(renaming ?? "") ?? 0, "voter")} in{" "}
            <span className="font-mono">{renaming}</span> will move to the new name, and because the
            class is the password they sign in with it from then on. Ballots they have already cast are
            not touched.
          </p>
        </form>
      </Modal>

      <Modal
        open={Boolean(pendingClassRemoval)}
        title="Remove every voter in this class?"
        onClose={() => (classBusy ? undefined : setPendingClassRemoval(null))}
        footer={
          <>
            <Button
              variant="ghost"
              className="border border-outline-variant"
              onClick={() => setPendingClassRemoval(null)}
              disabled={classBusy}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void confirmClassRemoval()} disabled={classBusy}>
              {classBusy ? "Removing…" : "Yes, remove them all"}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-on-surface-variant">
          {pluralise(classCounts.get(pendingClassRemoval ?? "") ?? 0, "voter")} in{" "}
          <strong className="font-mono text-on-surface">{pendingClassRemoval}</strong> will lose access
          immediately.
        </p>
        <p className="mt-4 border-t border-dashed border-outline-variant pt-4 text-xs leading-relaxed text-on-surface-variant">
          The class itself stays on the list, so you can add a new intake to it. Their receipts and
          change-my-vote pointers are cleared; the ballots themselves are anonymous and stay in the
          count. This cannot be undone.
        </p>
      </Modal>

      <Modal
        open={Boolean(pendingClassDelete)}
        title="Delete this class?"
        onClose={() => (classBusy ? undefined : setPendingClassDelete(null))}
        footer={
          <>
            <Button
              variant="ghost"
              className="border border-outline-variant"
              onClick={() => setPendingClassDelete(null)}
              disabled={classBusy}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void confirmClassDelete()} disabled={classBusy}>
              {classBusy ? "Deleting…" : "Yes, delete"}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-on-surface-variant">
          <strong className="font-mono text-on-surface">{pendingClassDelete}</strong> comes off the class
          list, so students no longer see it when they sign in.
        </p>
        <p className="mt-4 border-t border-dashed border-outline-variant pt-4 text-xs leading-relaxed text-on-surface-variant">
          No voters are in this class, so nothing else changes.
        </p>
      </Modal>
    </AppShell>
  );
}
