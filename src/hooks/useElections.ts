import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import type { Candidate, Election, ElectionResultRow, ElectionSummary, Turnout } from "@/types";

const SKIP_STORAGE_PREFIX = "ofkossec.skippedElections";

/**
 * Skipped elections are remembered per signed-in student for the life of the
 * browser tab, so a skip is respected by the "next ballot" walk without ever
 * being counted as a vote. The student can still open a skipped election from
 * the ballot sheet at any time.
 */
function skipStorageKey(): string | null {
  const userId = useAuthStore.getState().session?.user.id;
  return userId ? `${SKIP_STORAGE_PREFIX}.${userId}` : null;
}

function readSkipped(): Set<string> {
  const key = skipStorageKey();
  if (!key) return new Set();
  try {
    const raw = window.sessionStorage.getItem(key);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function markElectionSkipped(electionId: string) {
  const key = skipStorageKey();
  if (!key) return;
  const skipped = readSkipped();
  skipped.add(electionId);
  try {
    window.sessionStorage.setItem(key, JSON.stringify([...skipped]));
  } catch {
    // Storage may be unavailable (private mode); skipping still works this view.
  }
}

/** All elections, with candidate counts and whether the current user has voted. */
export function useElections() {
  const userId = useAuthStore((state) => state.session?.user.id ?? null);
  const [elections, setElections] = useState<ElectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [electionsRes, candidatesRes] = await Promise.all([
      supabase.from("elections").select("*").order("created_at", { ascending: false }),
      supabase.from("candidates").select("id, election_id"),
    ]);

    if (electionsRes.error) {
      setError(electionsRes.error.message);
      setLoading(false);
      return;
    }

    const counts = new Map<string, number>();
    for (const row of candidatesRes.data ?? []) {
      counts.set(row.election_id, (counts.get(row.election_id) ?? 0) + 1);
    }

    // "Has this person voted" must be scoped to the caller: an officer can read
    // every ballot, so an unfiltered read would badge every election as voted.
    const voted = new Set<string>();
    if (userId) {
      const { data: votes } = await supabase
        .from("votes")
        .select("election_id")
        .eq("voter_id", userId);
      for (const row of votes ?? []) voted.add(row.election_id as string);
    }

    setElections(
      (electionsRes.data as Election[]).map((election) => ({
        ...election,
        candidateCount: counts.get(election.id) ?? 0,
        hasVoted: voted.has(election.id),
      })),
    );
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load, userId]);

  return { elections, loading, error, reload: load };
}

/**
 * Open elections the signed-in voter has not cast a ballot in yet, newest
 * first. Used to walk a student straight on to their next ballot.
 */
export async function fetchRemainingOpenElections(excludeId?: string): Promise<Election[]> {
  const [electionsRes, votesRes] = await Promise.all([
    supabase
      .from("elections")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false }),
    supabase.from("votes").select("election_id"),
  ]);

  if (electionsRes.error) {
    console.error("Could not load open elections", electionsRes.error.message);
    return [];
  }

  const voted = new Set((votesRes.data ?? []).map((row) => row.election_id as string));
  const skipped = readSkipped();

  return ((electionsRes.data ?? []) as Election[]).filter(
    (election) =>
      election.id !== excludeId && !voted.has(election.id) && !skipped.has(election.id),
  );
}

interface ElectionDetailState {
  election: Election | null;
  candidates: Candidate[];
  hasVoted: boolean;
  loading: boolean;
  error: string | null;
}

/** A single election plus its candidates and the caller's ballot state. */
export function useElectionDetail(electionId: string | undefined) {
  const userId = useAuthStore((state) => state.session?.user.id ?? null);
  const [state, setState] = useState<ElectionDetailState>({
    election: null,
    candidates: [],
    hasVoted: false,
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    if (!electionId) {
      setState({ election: null, candidates: [], hasVoted: false, loading: false, error: "Missing election" });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    // Filter by voter so an officer previewing a ballot is not mistaken for a
    // voter: admins can read every row, which would otherwise read as "voted".
    const votePromise = userId
      ? supabase
          .from("votes")
          .select("id")
          .eq("election_id", electionId)
          .eq("voter_id", userId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null } as { data: null; error: null });

    const [electionRes, candidatesRes, voteRes] = await Promise.all([
      supabase.from("elections").select("*").eq("id", electionId).maybeSingle(),
      supabase.from("candidates").select("*").eq("election_id", electionId).order("sort_order"),
      votePromise,
    ]);

    if (electionRes.error) {
      setState({ election: null, candidates: [], hasVoted: false, loading: false, error: electionRes.error.message });
      return;
    }

    setState({
      election: (electionRes.data as Election) ?? null,
      candidates: (candidatesRes.data as Candidate[]) ?? [],
      hasVoted: Boolean(voteRes.data),
      loading: false,
      error: null,
    });
  }, [electionId, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, reload: load };
}

/** Published tally for an election (RPC enforces the publish gate). */
export function useResults(electionId: string | undefined) {
  const [rows, setRows] = useState<ElectionResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!electionId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc("get_election_results", {
      p_election_id: electionId,
    });

    if (rpcError) {
      setError(rpcError.message);
      setRows([]);
    } else {
      setRows((data as ElectionResultRow[]) ?? []);
    }
    setLoading(false);
  }, [electionId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { rows, loading, error, reload: load };
}

/** Turnout figures for an election (admin only). */
export function useTurnout(electionId: string | undefined, enabled: boolean) {
  const [turnout, setTurnout] = useState<Turnout | null>(null);

  const load = useCallback(async () => {
    if (!electionId || !enabled) return;
    const { data, error } = await supabase.rpc("get_election_turnout", {
      p_election_id: electionId,
    });
    if (error) {
      console.error("Could not load turnout", error.message);
      return;
    }
    const row = Array.isArray(data) ? data[0] : null;
    setTurnout(row ? { voted: Number(row.voted), eligible: Number(row.eligible) } : null);
  }, [electionId, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  return { turnout, reload: load };
}

/** Elections the signed-in user has already voted in. */
export function useVotingHistory() {
  const userId = useAuthStore((state) => state.session?.user.id ?? null);
  const [items, setItems] = useState<Array<{ election: Election; createdAt: string }>>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    // Two queries rather than a PostgREST embed: the schema uses logical
    // foreign keys, so there is no relationship for PostgREST to follow.
    const { data: votes, error } = await supabase
      .from("votes")
      .select("election_id, created_at")
      .order("created_at", { ascending: false });

    if (error || !votes || votes.length === 0) {
      if (error) console.error("Could not load voting history", error.message);
      setItems([]);
      setLoading(false);
      return;
    }

    const ids = votes.map((vote) => vote.election_id);
    const { data: elections, error: electionsError } = await supabase
      .from("elections")
      .select("*")
      .in("id", ids);

    if (electionsError) {
      console.error("Could not load voted elections", electionsError.message);
      setItems([]);
      setLoading(false);
      return;
    }

    const byId = new Map((elections as Election[]).map((election) => [election.id, election]));
    setItems(
      votes
        .map((vote) => {
          const election = byId.get(vote.election_id);
          return election ? { election, createdAt: vote.created_at as string } : null;
        })
        .filter((item): item is { election: Election; createdAt: string } => item !== null),
    );
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { items, loading, reload: load };
}
