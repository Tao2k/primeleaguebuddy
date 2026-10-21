"use server";

import { redirect } from "next/navigation";
import { devLoginEnabled, endSession, startSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { safeNextPath } from "./next-path";

export async function devLogin(formData: FormData) {
  if (!devLoginEnabled()) throw new Error("Dev-Login ist deaktiviert.");
  const name = String(formData.get("name") ?? "").trim().slice(0, 40);
  if (!name) redirect("/login");
  // Each dev name maps to a stable fake Discord id, so logging in twice yields the same user.
  const discordId = `dev:${name.toLowerCase()}`;
  const user = await db.user.upsert({ where: { discordId }, create: { discordId, name }, update: {} });
  await startSession(user.id);
  redirect(safeNextPath(String(formData.get("next") ?? "")));
}

export async function logout() {
  await endSession();
  redirect("/login");
}
