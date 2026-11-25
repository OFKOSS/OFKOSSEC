import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { CLASS_OPTIONS } from "@/lib/constants";

/**
 * The class list lives in the database (public.classes) so officers can rename
 * and add classes without a new deployment. The built-in list in
 * src/lib/constants.ts is the fallback for the moment before migration 013 has
 * run, or if the read fails.
 */
export async function fetchClasses(): Promise<string[]> {
  const { data, error } = await supabase
    .from("classes")
    .select("name")
    .order("position", { ascending: true });

  if (error) {
    console.error("Could not load the class list", error.message);
    return CLASS_OPTIONS;
  }

  const names = (data ?? [])
    .map((row) => row.name as string)
    .filter((name) => Boolean(name));

  return names.length > 0 ? names : CLASS_OPTIONS;
}

export function useClasses() {
  const [classes, setClasses] = useState<string[]>(CLASS_OPTIONS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setClasses(await fetchClasses());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { classes, loading, reload: load };
}
