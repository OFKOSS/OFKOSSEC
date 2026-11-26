export type Role = "student" | "admin";

export type ElectionStatus = "draft" | "active" | "closed";

/** A voter's gender, or null when the officer has not recorded one yet. */
export type Gender = "male" | "female";

/** Who may cast a ballot in an election. "any" is the unrestricted default. */
export type EligibleGender = "any" | Gender;

export interface Profile {
  id: string;
  full_name: string;
  student_id: string | null;
  class_name: string | null;
  role: Role;
  gender: Gender | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Election {
  id: string;
  title: string;
  position: string;
  description: string | null;
  status: ElectionStatus;
  results_public: boolean;
  /** "any" unless the ballot is restricted to one gender (migration 017). */
  eligible_gender: EligibleGender;
  starts_at: string | null;
  ends_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Candidate {
  id: string;
  election_id: string;
  name: string;
  class_name: string | null;
  slogan: string | null;
  manifesto: string | null;
  photo_url: string | null;
  sort_order: number;
  created_at: string;
}

/**
 * A ballot. Anonymous by design: there is deliberately no voter on the row.
 * Whether somebody has voted lives separately, in BallotReceipt.
 */
export interface Vote {
  id: string;
  election_id: string;
  candidate_id: string;
  created_at: string;
}

/** Proof that a voter took part in an election, with no record of the choice. */
export interface BallotReceipt {
  election_id: string;
  voter_id: string;
  created_at: string;
}

export interface ElectionResultRow {
  candidate_id: string;
  candidate_name: string;
  class_name: string | null;
  slogan: string | null;
  photo_url: string | null;
  sort_order: number;
  vote_count: number;
}

export interface Turnout {
  voted: number;
  eligible: number;
}

/** An election plus the counts the hub needs, assembled on the client. */
export interface ElectionSummary extends Election {
  candidateCount: number;
  hasVoted: boolean;
}

export interface CandidateDraft {
  id?: string;
  name: string;
  class_name: string;
  slogan: string;
  manifesto: string;
  photo_url: string;
}

export interface ElectionDraft {
  title: string;
  position: string;
  description: string;
  status: ElectionStatus;
  results_public: boolean;
  eligible_gender: EligibleGender;
  starts_at: string;
  ends_at: string;
}

/** One row of the officer audit trail (public.audit_log, migration 016). */
export interface AuditLogEntry {
  id: number;
  created_at: string;
  actor_id: string | null;
  /** The officer's index number or name, or "system" for unattributed writes. */
  actor_label: string;
  /** "<entity>.<verb>" — for example "voter.update" or "class.create". */
  action: string;
  /** voter | class | election | candidate */
  entity: string;
  entity_id: string | null;
  /** How the affected row is named in a sentence. */
  label: string;
  /** Column changes as {field: {from, to}}, or {removed: <row>} on a delete. */
  details: Record<string, unknown> | null;
}
