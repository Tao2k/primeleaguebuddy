import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { discordClient, startSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { safeNextPath } from "../../next-path";

type DiscordUser = { id: string; username: string; global_name: string | null; avatar: string | null };

export async function GET(request: NextRequest) {
  const discord = discordClient();
  if (!discord) return new NextResponse("Discord-Login ist nicht konfiguriert.", { status: 503 });

  const store = await cookies();
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = store.get("discord_oauth_state")?.value;
  const next = safeNextPath(store.get("login_next")?.value);
  store.delete("discord_oauth_state");
  store.delete("login_next");
  if (!code || !state || state !== expectedState) {
    return NextResponse.redirect(new URL("/login?error=state", request.url));
  }

  let profile: DiscordUser;
  try {
    const tokens = await discord.validateAuthorizationCode(code, null);
    const response = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokens.accessToken()}` },
    });
    if (!response.ok) throw new Error(`Discord antwortet mit ${response.status}`);
    profile = await response.json();
  } catch {
    return NextResponse.redirect(new URL("/login?error=discord", request.url));
  }

  const avatarUrl = profile.avatar
    ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png?size=64`
    : null;
  const name = profile.global_name ?? profile.username;
  const user = await db.user.upsert({
    where: { discordId: profile.id },
    create: { discordId: profile.id, name, avatarUrl },
    update: { name, avatarUrl },
  });
  await startSession(user.id);
  return NextResponse.redirect(new URL(next, request.url));
}
