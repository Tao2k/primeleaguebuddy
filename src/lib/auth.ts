import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Discord } from "arctic";
import { db } from "./db";

const SESSION_COOKIE = "plb_session";
const SESSION_DAYS = 30;

export function discordClient(): Discord | null {
  const { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, APP_URL } = process.env;
  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET || !APP_URL) return null;
  return new Discord(DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, `${APP_URL}/login/discord/callback`);
}

/** Name-only login for local development, never available in production. */
export function devLoginEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.DEV_LOGIN === "true";
}

export function randomToken(): string {
  return randomBytes(24).toString("base64url");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function startSession(userId: string): Promise<void> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.session.create({ data: { id: hashToken(token), userId, expiresAt } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: hashToken(token) } });
  store.delete(SESSION_COOKIE);
}

/** The signed-in user, or null. Cached per request. */
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { id: hashToken(token) }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** The user's membership in a team; redirects home when they are not a member. */
export async function requireMembership(teamId: string) {
  const user = await requireUser();
  const membership = await db.membership.findUnique({
    where: { userId_teamId: { userId: user.id, teamId } },
    include: { team: true },
  });
  if (!membership) redirect("/");
  return { user, membership, team: membership.team, isLeader: membership.role === "LEADER" };
}

export async function requireLeader(teamId: string) {
  const ctx = await requireMembership(teamId);
  if (!ctx.isLeader) throw new Error("Nur Teamleiter dürfen das.");
  return ctx;
}
