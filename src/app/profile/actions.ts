"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

const profileSchema = z.object({
  riotId: z
    .string()
    .trim()
    .transform((v) => v || null)
    .pipe(z.string().regex(/^.{3,16}#[A-Za-z0-9]{2,5}$/, "Die Riot ID hat das Format Name#TAG.").nullable()),
  mainRole: z
    .string()
    .transform((v) => v || null)
    .pipe(z.enum(["TOP", "JUNGLE", "MID", "BOT", "SUPPORT", "FILL"]).nullable()),
});

export async function updateProfile(formData: FormData) {
  const user = await requireUser();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/profile?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  await db.user.update({ where: { id: user.id }, data: parsed.data });
  revalidatePath("/", "layout");
  redirect("/profile?saved=1");
}
