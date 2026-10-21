import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, rankSlots, validateSlot, type Member, type Rules } from "./scheduling";
import { berlinParts, parseBerlinDateTime, parseBerlinDay } from "./time";

const now = new Date("2026-10-01T00:00:00Z");
const window = {
  windowStart: parseBerlinDay("2026-10-26", "start")!,
  windowEnd: parseBerlinDay("2026-11-01", "end")!,
};
const rules: Rules = {
  ...DEFAULT_RULES,
  allowedWeekdays: [1, 2, 3, 4, 7],
  earliestStartMinutes: 18 * 60,
  latestStartMinutes: 21 * 60,
};

describe("time helpers", () => {
  it("parses datetime-local values as Berlin time, across the DST switch", () => {
    // 25 Oct 2026 is the switch from CEST (UTC+2) to CET (UTC+1).
    expect(parseBerlinDateTime("2026-10-24T19:00")!.toISOString()).toBe("2026-10-24T17:00:00.000Z");
    expect(parseBerlinDateTime("2026-10-28T19:00")!.toISOString()).toBe("2026-10-28T18:00:00.000Z");
  });

  it("reads weekday and clock time in Berlin", () => {
    expect(berlinParts(new Date("2026-10-28T18:30:00Z"))).toEqual({ isoWeekday: 3, minutes: 19 * 60 + 30 });
    expect(berlinParts(new Date("2026-11-01T23:30:00Z"))).toEqual({ isoWeekday: 1, minutes: 30 });
  });

  it("rejects malformed input", () => {
    expect(parseBerlinDateTime("28.10.2026 19:00")).toBeNull();
    expect(parseBerlinDay("2026-1-5", "start")).toBeNull();
  });
});

describe("validateSlot", () => {
  it("accepts a slot inside the window, on an allowed day and time", () => {
    expect(validateSlot(parseBerlinDateTime("2026-10-28T19:00")!, window, rules, now)).toEqual([]);
  });

  it("accepts the latest allowed start time exactly", () => {
    expect(validateSlot(parseBerlinDateTime("2026-10-28T21:00")!, window, rules, now)).toEqual([]);
  });

  it("rejects slots outside the matchday window", () => {
    const problems = validateSlot(parseBerlinDateTime("2026-11-02T19:00")!, window, rules, now);
    expect(problems).toContain("Der Termin liegt außerhalb des Spieltag-Zeitraums.");
  });

  it("rejects disallowed weekdays and times", () => {
    const friday = validateSlot(parseBerlinDateTime("2026-10-30T19:00")!, window, rules, now);
    expect(friday).toEqual(["Fr ist laut Regelprofil kein erlaubter Spieltag."]);
    const early = validateSlot(parseBerlinDateTime("2026-10-28T17:30")!, window, rules, now);
    expect(early).toEqual(["Frühester Spielbeginn ist 18:00 Uhr."]);
    const late = validateSlot(parseBerlinDateTime("2026-10-28T21:15")!, window, rules, now);
    expect(late).toEqual(["Spätester Spielbeginn ist 21:00 Uhr."]);
  });

  it("rejects slots in the past", () => {
    const later = new Date("2026-10-29T00:00:00Z");
    expect(validateSlot(parseBerlinDateTime("2026-10-28T19:00")!, window, rules, later)).toContain(
      "Der Termin liegt in der Vergangenheit.",
    );
  });
});

describe("rankSlots", () => {
  const members: Member[] = [
    { userId: "top", name: "Top", mainRole: "TOP" },
    { userId: "jgl", name: "Jungle", mainRole: "JUNGLE" },
    { userId: "mid", name: "Mid", mainRole: "MID" },
    { userId: "bot", name: "Bot", mainRole: "BOT" },
    { userId: "sup", name: "Support", mainRole: "SUPPORT" },
    { userId: "sub", name: "Sub", mainRole: "FILL" },
  ];
  const at = (s: string) => parseBerlinDateTime(s)!;
  const votes = (yes: string[], maybe: string[] = [], no: string[] = []) => [
    ...yes.map((userId) => ({ userId, answer: "YES" as const })),
    ...maybe.map((userId) => ({ userId, answer: "MAYBE" as const })),
    ...no.map((userId) => ({ userId, answer: "NO" as const })),
  ];

  it("puts confirmed slots first and recommends up to proposalCount playable slots", () => {
    const ranked = rankSlots(
      [
        { id: "a", startsAt: at("2026-10-26T19:00"), votes: votes(["top", "jgl", "mid"], ["bot"], ["sup"]) },
        { id: "b", startsAt: at("2026-10-27T19:00"), votes: votes(["top", "jgl", "mid", "bot", "sup"]) },
        { id: "c", startsAt: at("2026-10-28T19:00"), votes: votes(["top", "jgl", "mid"], ["bot", "sup"]) },
        { id: "d", startsAt: at("2026-10-29T19:00"), votes: votes(["top", "jgl", "mid", "bot", "sub"]) },
      ],
      members,
      { ...rules, proposalCount: 2 },
    );
    expect(ranked.map((s) => s.id)).toEqual(["b", "d", "c", "a"]);
    expect(ranked.map((s) => s.recommended)).toEqual([true, true, false, false]);
    expect(ranked[0].pending.map((m) => m.userId)).toEqual(["sub"]);
  });

  it("lets a FILL player cover one missing role", () => {
    const [slot] = rankSlots(
      [{ id: "a", startsAt: at("2026-10-26T19:00"), votes: votes(["top", "jgl", "mid", "sub"]) }],
      members,
      rules,
    );
    expect(slot.missingRoles).toEqual(["SUPPORT"]);
    expect(slot.confirmed).toBe(false);
    expect(slot.possible).toBe(false);
  });

  it("treats players without a main role like FILL players", () => {
    const unknown: Member[] = ["a", "b", "c", "d", "e"].map((userId) => ({ userId, name: userId, mainRole: null }));
    const [slot] = rankSlots(
      [{ id: "a", startsAt: at("2026-10-26T19:00"), votes: votes(["a", "b", "c", "d", "e"]) }],
      unknown,
      rules,
    );
    expect(slot.missingRoles).toEqual([]);
    expect(slot.confirmed).toBe(true);
  });

  it("never recommends slots that cannot reach the minimum player count", () => {
    const ranked = rankSlots(
      [{ id: "a", startsAt: at("2026-10-26T19:00"), votes: votes(["top"], [], ["jgl", "mid", "bot", "sup"]) }],
      members,
      rules,
    );
    expect(ranked[0].recommended).toBe(false);
  });
});
