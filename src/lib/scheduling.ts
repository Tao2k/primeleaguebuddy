import { berlinParts, formatClock, weekdayLabel } from "./time";

export type Answer = "YES" | "MAYBE" | "NO";
export type LolRole = "TOP" | "JUNGLE" | "MID" | "BOT" | "SUPPORT" | "FILL";

export const CORE_ROLES: LolRole[] = ["TOP", "JUNGLE", "MID", "BOT", "SUPPORT"];

export type Rules = {
  allowedWeekdays: number[];
  earliestStartMinutes: number;
  latestStartMinutes: number;
  minPlayers: number;
  proposalCount: number;
};

export const DEFAULT_RULES: Rules = {
  allowedWeekdays: [1, 2, 3, 4, 5, 6, 7],
  earliestStartMinutes: 18 * 60,
  latestStartMinutes: 22 * 60,
  minPlayers: 5,
  proposalCount: 3,
};

export type Window = { windowStart: Date; windowEnd: Date };

/** Returns the reasons a slot breaks the rules; empty when it is allowed. */
export function validateSlot(startsAt: Date, window: Window, rules: Rules, now = new Date()): string[] {
  const problems: string[] = [];
  if (startsAt < now) {
    problems.push("Der Termin liegt in der Vergangenheit.");
  }
  if (startsAt < window.windowStart || startsAt > window.windowEnd) {
    problems.push("Der Termin liegt außerhalb des Spieltag-Zeitraums.");
  }
  const { isoWeekday, minutes } = berlinParts(startsAt);
  if (!rules.allowedWeekdays.includes(isoWeekday)) {
    problems.push(`${weekdayLabel(isoWeekday)} ist laut Regelprofil kein erlaubter Spieltag.`);
  }
  if (minutes < rules.earliestStartMinutes) {
    problems.push(`Frühester Spielbeginn ist ${formatClock(rules.earliestStartMinutes)} Uhr.`);
  }
  if (minutes > rules.latestStartMinutes) {
    problems.push(`Spätester Spielbeginn ist ${formatClock(rules.latestStartMinutes)} Uhr.`);
  }
  return problems;
}

export type Member = { userId: string; name: string; mainRole: LolRole | null };
export type SlotInput = { id: string; startsAt: Date; votes: { userId: string; answer: Answer }[] };

export type RankedSlot = {
  id: string;
  startsAt: Date;
  yes: Member[];
  maybe: Member[];
  no: Member[];
  pending: Member[];
  /** Enough confirmed players to play. */
  confirmed: boolean;
  /** Enough players if every "maybe" turns into a "yes". */
  possible: boolean;
  missingRoles: LolRole[];
  /** One of the best slots to propose to the opponent. */
  recommended: boolean;
};

/** Ranks slots by how likely the team can play them, best first. */
export function rankSlots(slots: SlotInput[], members: Member[], rules: Rules): RankedSlot[] {
  const ranked = slots.map((slot) => {
    const answers = new Map(slot.votes.map((v) => [v.userId, v.answer]));
    const yes = members.filter((m) => answers.get(m.userId) === "YES");
    const maybe = members.filter((m) => answers.get(m.userId) === "MAYBE");
    const no = members.filter((m) => answers.get(m.userId) === "NO");
    const pending = members.filter((m) => !answers.has(m.userId));
    const covered = new Set(yes.map((m) => m.mainRole));
    // A FILL player, or one without a main role, can cover any one missing role.
    let fillers = yes.filter((m) => m.mainRole === "FILL" || m.mainRole === null).length;
    const missingRoles = CORE_ROLES.filter((role) => {
      if (covered.has(role)) return false;
      if (fillers > 0) {
        fillers -= 1;
        return false;
      }
      return true;
    });
    return {
      id: slot.id,
      startsAt: slot.startsAt,
      yes,
      maybe,
      no,
      pending,
      confirmed: yes.length >= rules.minPlayers,
      possible: yes.length + maybe.length >= rules.minPlayers,
      missingRoles,
      recommended: false,
    };
  });

  ranked.sort(
    (a, b) =>
      Number(b.confirmed) - Number(a.confirmed) ||
      Number(b.possible) - Number(a.possible) ||
      b.yes.length - a.yes.length ||
      a.missingRoles.length - b.missingRoles.length ||
      b.maybe.length - a.maybe.length ||
      a.no.length - b.no.length ||
      a.startsAt.getTime() - b.startsAt.getTime(),
  );

  let picked = 0;
  for (const slot of ranked) {
    if (picked >= rules.proposalCount || !slot.possible) break;
    slot.recommended = true;
    picked += 1;
  }
  return ranked;
}
