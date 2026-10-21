"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireLeader, requireMembership, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEFAULT_RULES, validateSlot } from "@/lib/scheduling";
import { parseBerlinDateTime, parseBerlinDay, parseClock } from "@/lib/time";

function newInviteCode(): string {
  return randomBytes(9).toString("base64url");
}

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

const optionalText = z
  .string()
  .trim()
  .max(200)
  .transform((v) => v || null);

const optionalUrl = z
  .string()
  .trim()
  .transform((v) => v || null)
  .pipe(z.url({ protocol: /^https?$/ }).nullable());

const teamSchema = z.object({
  name: z.string().trim().min(2, "Der Teamname braucht mindestens 2 Zeichen.").max(60),
  tag: optionalText.pipe(z.string().max(8, "Das Kürzel darf höchstens 8 Zeichen haben.").nullable()),
  primeLeagueUrl: optionalUrl,
});

export async function createTeam(formData: FormData) {
  const user = await requireUser();
  const parsed = teamSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail("/", parsed.error.issues[0].message);

  const team = await db.team.create({
    data: {
      ...parsed.data,
      inviteCode: newInviteCode(),
      memberships: { create: { userId: user.id, role: "LEADER" } },
      rules: { create: {} },
    },
  });
  redirect(`/teams/${team.id}`);
}

export async function joinTeam(inviteCode: string) {
  const user = await requireUser();
  const team = await db.team.findUnique({ where: { inviteCode } });
  if (!team) fail("/", "Der Einladungslink ist ungültig oder wurde erneuert.");
  await db.membership.upsert({
    where: { userId_teamId: { userId: user.id, teamId: team.id } },
    create: { userId: user.id, teamId: team.id },
    update: {},
  });
  redirect(`/teams/${team.id}`);
}

export async function updateTeam(teamId: string, formData: FormData) {
  await requireLeader(teamId);
  const path = `/teams/${teamId}/settings`;
  const parsed = teamSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail(path, parsed.error.issues[0].message);
  await db.team.update({ where: { id: teamId }, data: parsed.data });
  revalidatePath(`/teams/${teamId}`, "layout");
  redirect(path);
}

export async function renewInviteCode(teamId: string) {
  await requireLeader(teamId);
  await db.team.update({ where: { id: teamId }, data: { inviteCode: newInviteCode() } });
  revalidatePath(`/teams/${teamId}`, "layout");
}

export async function setMemberRole(teamId: string, membershipId: string, role: "LEADER" | "MEMBER") {
  const { membership: own } = await requireLeader(teamId);
  if (membershipId === own.id && role === "MEMBER") {
    const leaders = await db.membership.count({ where: { teamId, role: "LEADER" } });
    if (leaders <= 1) fail(`/teams/${teamId}/settings`, "Das Team braucht mindestens einen Teamleiter.");
  }
  await db.membership.update({ where: { id: membershipId, teamId }, data: { role } });
  revalidatePath(`/teams/${teamId}`, "layout");
}

export async function removeMember(teamId: string, membershipId: string) {
  const { membership: own } = await requireLeader(teamId);
  if (membershipId === own.id) fail(`/teams/${teamId}/settings`, "Du kannst dich nicht selbst entfernen.");
  await db.membership.delete({ where: { id: membershipId, teamId } });
  revalidatePath(`/teams/${teamId}`, "layout");
}

const rulesSchema = z
  .object({
    allowedWeekdays: z
      .array(z.coerce.number().int().min(1).max(7))
      .min(1, "Mindestens ein Wochentag muss erlaubt sein."),
    earliestStart: z.string().transform((v, ctx) => {
      const minutes = parseClock(v);
      if (minutes === null) {
        ctx.addIssue({ code: "custom", message: "Ungültige früheste Startzeit." });
        return z.NEVER;
      }
      return minutes;
    }),
    latestStart: z.string().transform((v, ctx) => {
      const minutes = parseClock(v);
      if (minutes === null) {
        ctx.addIssue({ code: "custom", message: "Ungültige späteste Startzeit." });
        return z.NEVER;
      }
      return minutes;
    }),
    minPlayers: z.coerce.number().int().min(1).max(10),
    proposalCount: z.coerce.number().int().min(1).max(10),
  })
  .refine((r) => r.earliestStart <= r.latestStart, "Die früheste Startzeit muss vor der spätesten liegen.");

export async function updateRules(teamId: string, formData: FormData) {
  await requireLeader(teamId);
  const path = `/teams/${teamId}/settings`;
  const parsed = rulesSchema.safeParse({
    allowedWeekdays: formData.getAll("allowedWeekdays"),
    earliestStart: formData.get("earliestStart"),
    latestStart: formData.get("latestStart"),
    minPlayers: formData.get("minPlayers"),
    proposalCount: formData.get("proposalCount"),
  });
  if (!parsed.success) fail(path, parsed.error.issues[0].message);
  const data = {
    allowedWeekdays: [...new Set(parsed.data.allowedWeekdays)].sort(),
    earliestStartMinutes: parsed.data.earliestStart,
    latestStartMinutes: parsed.data.latestStart,
    minPlayers: parsed.data.minPlayers,
    proposalCount: parsed.data.proposalCount,
  };
  await db.ruleProfile.upsert({ where: { teamId }, create: { teamId, ...data }, update: data });
  revalidatePath(`/teams/${teamId}`, "layout");
  redirect(`${path}?saved=1`);
}

const matchdaySchema = z.object({
  title: z.string().trim().min(1, "Bitte gib dem Spieltag einen Namen.").max(80),
  opponentName: optionalText,
  opponentUrl: optionalUrl,
  windowStart: z.string(),
  windowEnd: z.string(),
  proposalDeadline: z.string(),
});

export async function createMatchday(teamId: string, formData: FormData) {
  await requireLeader(teamId);
  const path = `/teams/${teamId}`;
  const parsed = matchdaySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail(path, parsed.error.issues[0].message);
  const windowStart = parseBerlinDay(parsed.data.windowStart, "start");
  const windowEnd = parseBerlinDay(parsed.data.windowEnd, "end");
  if (!windowStart || !windowEnd) fail(path, "Bitte gib Start und Ende des Spieltags an.");
  if (windowEnd < windowStart) fail(path, "Das Ende des Spieltags liegt vor dem Start.");
  const proposalDeadline = parsed.data.proposalDeadline ? parseBerlinDateTime(parsed.data.proposalDeadline) : null;

  const matchday = await db.matchday.create({
    data: {
      teamId,
      title: parsed.data.title,
      opponentName: parsed.data.opponentName,
      opponentUrl: parsed.data.opponentUrl,
      windowStart,
      windowEnd,
      proposalDeadline,
    },
  });
  redirect(`/teams/${teamId}/matchdays/${matchday.id}`);
}

export async function deleteMatchday(teamId: string, matchdayId: string) {
  await requireLeader(teamId);
  await db.matchday.delete({ where: { id: matchdayId, teamId } });
  revalidatePath(`/teams/${teamId}`, "layout");
  redirect(`/teams/${teamId}`);
}

async function loadMatchday(teamId: string, matchdayId: string) {
  const matchday = await db.matchday.findUnique({ where: { id: matchdayId, teamId } });
  if (!matchday) redirect(`/teams/${teamId}`);
  return matchday;
}

export async function addSlot(teamId: string, matchdayId: string, formData: FormData) {
  const { user } = await requireMembership(teamId);
  const matchday = await loadMatchday(teamId, matchdayId);
  const path = `/teams/${teamId}/matchdays/${matchdayId}`;
  const startsAt = parseBerlinDateTime(String(formData.get("startsAt") ?? ""));
  if (!startsAt) fail(path, "Bitte wähle Datum und Uhrzeit.");

  const rules = (await db.ruleProfile.findUnique({ where: { teamId } })) ?? DEFAULT_RULES;
  const problems = validateSlot(startsAt, matchday, rules);
  if (problems.length > 0) fail(path, problems.join(" "));

  const existing = await db.slot.findUnique({ where: { matchdayId_startsAt: { matchdayId, startsAt } } });
  if (existing) fail(path, "Diesen Zeitslot gibt es schon.");
  // Whoever proposes a slot is available for it.
  await db.slot.create({
    data: { matchdayId, startsAt, createdById: user.id, votes: { create: { userId: user.id, answer: "YES" } } },
  });
  revalidatePath(path);
  redirect(path);
}

export async function deleteSlot(teamId: string, matchdayId: string, slotId: string) {
  const { user, isLeader } = await requireMembership(teamId);
  const slot = await db.slot.findUnique({ where: { id: slotId, matchdayId, matchday: { teamId } } });
  if (!slot) return;
  if (slot.createdById !== user.id && !isLeader) throw new Error("Nur wer den Slot angelegt hat oder Teamleiter dürfen ihn löschen.");
  await db.slot.delete({ where: { id: slotId } });
  revalidatePath(`/teams/${teamId}/matchdays/${matchdayId}`);
}

export async function vote(teamId: string, matchdayId: string, slotId: string, answer: "YES" | "MAYBE" | "NO") {
  const { user } = await requireMembership(teamId);
  const slot = await db.slot.findUnique({ where: { id: slotId, matchdayId, matchday: { teamId } } });
  if (!slot) return;
  await db.vote.upsert({
    where: { slotId_userId: { slotId, userId: user.id } },
    create: { slotId, userId: user.id, answer },
    update: { answer },
  });
  revalidatePath(`/teams/${teamId}/matchdays/${matchdayId}`);
}

export async function confirmSlot(teamId: string, matchdayId: string, slotId: string | null) {
  await requireLeader(teamId);
  if (slotId) {
    const slot = await db.slot.findUnique({ where: { id: slotId, matchdayId } });
    if (!slot) return;
  }
  await db.matchday.update({ where: { id: matchdayId, teamId }, data: { confirmedSlotId: slotId } });
  revalidatePath(`/teams/${teamId}`, "layout");
}
