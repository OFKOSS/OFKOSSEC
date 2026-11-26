import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { AuditLogEntry } from "@/types";

/** How many of the newest entries the viewer pulls at a time. */
export const AUDIT_PAGE_SIZE = 200;

/**
 * The officer audit trail (public.audit_log, migration 016).
 *
 * Rows are written by a trigger on the tables officers can change, so this is
 * read-only by design — nobody has INSERT on the table except the recorder.
 * The `entity` filter runs in the database; free-text searching happens on the
 * page over the rows that are already loaded.
 */
export function useAuditLog(entity: string) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(AUDIT_PAGE_SIZE);

    if (entity !== "all") query = query.eq("entity", entity);

    const { data, error: loadError } = await query;

    if (loadError) {
      setError(loadError.message);
      setEntries([]);
    } else {
      setEntries((data as AuditLogEntry[]) ?? []);
    }
    setLoading(false);
  }, [entity]);

  useEffect(() => {
    void load();
  }, [load]);

  return { entries, loading, error, reload: load };
}
