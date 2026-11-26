import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { HOUSE_OPTIONS } from "@/lib/constants";

/**
 * The house list lives in the database (public.houses, migration 019) so
 * officers can rename the placeholders and add their own houses without a new
 * deployment. The built-in list in src/lib/constants.ts is the fallback for the
 * moment before migration 019 has run, or if the read fails.
 */
export async function fetchHouses(): Promise<string[]> {
  const { data, error } = await supabase
    .from("houses")
    .select("name")
    .order("position", { ascending: true });

  if (error) {
    console.error("Could not load the house list", error.message);
    return HOUSE_OPTIONS;
  }

  const names = (data ?? [])
    .map((row) => row.name as string)
    .filter((name) => Boolean(name));

  return names.length > 0 ? names : HOUSE_OPTIONS;
}

export function useHouses() {
  const [houses, setHouses] = useState<string[]>(HOUSE_OPTIONS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setHouses(await fetchHouses());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { houses, loading, reload: load };
}
