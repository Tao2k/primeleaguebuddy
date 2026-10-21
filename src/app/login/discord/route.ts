import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { discordClient, randomToken } from "@/lib/auth";
import { safeNextPath } from "../next-path";

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 10,
} as const;

export async function GET(request: NextRequest) {
  const discord = discordClient();
  if (!discord) return new NextResponse("Discord-Login ist nicht konfiguriert.", { status: 503 });

  const state = randomToken();
  const url = discord.createAuthorizationURL(state, null, ["identify"]);
  const store = await cookies();
  store.set("discord_oauth_state", state, COOKIE_OPTIONS);
  store.set("login_next", safeNextPath(request.nextUrl.searchParams.get("next")), COOKIE_OPTIONS);
  return NextResponse.redirect(url);
}
