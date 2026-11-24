import { describe, expect, it } from "vitest";
import {
  describeDeadline,
  initials,
  percent,
  pluralise,
  statusLabel,
  toDateTimeLocal,
} from "@/utils/format";

describe("initials", () => {
  it("takes the first letter of the first two names", () => {
    expect(initials("Ama Serwaa")).toBe("AS");
  });

  it("handles a single name", () => {
    expect(initials("Kwabena")).toBe("K");
  });

  it("ignores extra whitespace and later names", () => {
    expect(initials("  yaw   darko  mensah ")).toBe("YD");
  });
});

describe("percent", () => {
  it("rounds to one decimal place", () => {
    expect(percent(1, 3)).toBe(33.3);
  });

  it("returns 0 when there is nothing to divide by", () => {
    expect(percent(5, 0)).toBe(0);
  });

  it("handles a full house", () => {
    expect(percent(12, 12)).toBe(100);
  });
});

describe("pluralise", () => {
  it("uses the singular for one", () => {
    expect(pluralise(1, "vote")).toBe("1 vote");
  });

  it("uses the plural for many", () => {
    expect(pluralise(4, "vote")).toBe("4 votes");
  });

  it("accepts an irregular plural", () => {
    expect(pluralise(2, "ballot", "ballots")).toBe("2 ballots");
  });
});

describe("describeDeadline", () => {
  it("counts down while voting is live", () => {
    // Half a day of slack keeps the assertion stable while the clock ticks.
    const endsAt = new Date(Date.now() + 3.5 * 86_400_000).toISOString();
    expect(describeDeadline({ status: "active", ends_at: endsAt })).toBe("3 days left");
  });

  it("reports how long ago a closed election ended", () => {
    const endsAt = new Date(Date.now() - 2.5 * 86_400_000).toISOString();
    expect(describeDeadline({ status: "closed", ends_at: endsAt })).toBe("Closed 2 days ago");
  });

  it("falls back when no deadline is set", () => {
    expect(describeDeadline({ status: "draft", ends_at: null })).toBe("No deadline set");
  });
});

describe("statusLabel", () => {
  it("maps each status to friendly copy", () => {
    expect(statusLabel("active")).toBe("Voting live");
    expect(statusLabel("closed")).toBe("Voting closed");
    expect(statusLabel("draft")).toBe("Draft");
  });
});

describe("toDateTimeLocal", () => {
  it("returns an empty string for missing values", () => {
    expect(toDateTimeLocal(null)).toBe("");
  });

  it("formats a valid ISO string for a datetime-local input", () => {
    expect(toDateTimeLocal("2026-05-04T08:30:00.000Z")).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});
