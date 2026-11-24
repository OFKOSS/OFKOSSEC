import { describe, expect, it } from "vitest";
import {
  OFFICER_EMAIL_DOMAIN,
  VOTER_EMAIL_DOMAIN,
  isUsableIndexNumber,
  normalizeIndexNumber,
  officerEmailFromUsername,
  voterEmailFromIndex,
} from "@/lib/voterAuth";

// These tests lock in the contract with the SQL function public.voter_email()
// in supabase/migrations/005_voter_accounts.sql. If one side changes, both
// fail — which is the point.

describe("normalizeIndexNumber", () => {
  it("strips separators and lowercases", () => {
    expect(normalizeIndexNumber("SHS/2026/0148")).toBe("shs-2026-0148");
  });

  it("collapses runs of separators into one dash", () => {
    expect(normalizeIndexNumber("SHS // 2026 . 0148")).toBe("shs-2026-0148");
  });

  it("trims leading and trailing separators", () => {
    expect(normalizeIndexNumber("  /SHS/2026/0148/  ")).toBe("shs-2026-0148");
  });

  it("keeps plain alphanumeric index numbers intact", () => {
    expect(normalizeIndexNumber("0148")).toBe("0148");
  });

  it("returns an empty string when nothing usable remains", () => {
    expect(normalizeIndexNumber("///---")).toBe("");
    expect(normalizeIndexNumber("   ")).toBe("");
  });
});

describe("voterEmailFromIndex", () => {
  it("builds the deterministic login email", () => {
    expect(voterEmailFromIndex("SHS/2026/0148")).toBe(`shs-2026-0148@${VOTER_EMAIL_DOMAIN}`);
  });

  it("is case-insensitive and separator-insensitive", () => {
    expect(voterEmailFromIndex("shs 2026 0148")).toBe(voterEmailFromIndex("SHS/2026/0148"));
  });
});

describe("officerEmailFromUsername", () => {
  it("maps the school's officer username to its login email", () => {
    expect(officerEmailFromUsername("SO7")).toBe(`so7@${OFFICER_EMAIL_DOMAIN}`);
  });

  it("ignores case and surrounding spaces", () => {
    expect(officerEmailFromUsername("  so7  ")).toBe(`so7@${OFFICER_EMAIL_DOMAIN}`);
  });
});

describe("isUsableIndexNumber", () => {
  it("accepts a real index number", () => {
    expect(isUsableIndexNumber("SHS/2026/0148")).toBe(true);
  });

  it("rejects blank or separator-only input", () => {
    expect(isUsableIndexNumber("")).toBe(false);
    expect(isUsableIndexNumber("   ")).toBe(false);
    expect(isUsableIndexNumber("//")).toBe(false);
  });
});
