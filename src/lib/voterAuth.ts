/**
 * Voter login credentials.
 *
 * Students are created by an Electoral Officer with their index number as the
 * login name and their class as the password. Supabase Auth works with emails,
 * so we derive a deterministic address from the index number.
 *
 * !! Keep `normalizeIndexNumber` byte-for-byte in step with the SQL function
 * public.voter_email() in supabase/migrations/005_voter_accounts.sql.
 */

export const VOTER_EMAIL_DOMAIN = "voters.ballotbox.edu";
export const OFFICER_EMAIL_DOMAIN = "officers.ballotbox.edu";

/**
 * Trims, lowercases and collapses anything that is not a letter or digit into
 * a single dash. A real index number such as "005017200924" passes through
 * untouched; a slashed spelling such as "SHS/2026/0148" becomes
 * "shs-2026-0148".
 */
export function normalizeIndexNumber(indexNumber: string): string {
  return indexNumber
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** "005017200924" -> "005017200924@voters.ballotbox.edu" */
export function voterEmailFromIndex(indexNumber: string): string {
  return `${normalizeIndexNumber(indexNumber)}@${VOTER_EMAIL_DOMAIN}`;
}

/** An index number is usable only if it survives normalisation. */
export function isUsableIndexNumber(indexNumber: string): boolean {
  return normalizeIndexNumber(indexNumber).length > 0;
}

/**
 * "SO7" -> "so7@officers.ballotbox.edu"
 *
 * The school signs officers in with a plain username; same normalisation rule
 * as voters, mirrored by migration 006_officer_account.sql.
 */
export function officerEmailFromUsername(username: string): string {
  return `${normalizeIndexNumber(username)}@${OFFICER_EMAIL_DOMAIN}`;
}

