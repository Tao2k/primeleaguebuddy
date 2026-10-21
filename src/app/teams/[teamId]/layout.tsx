import Link from "next/link";
import { requireMembership } from "@/lib/auth";

export default async function TeamLayout(props: LayoutProps<"/teams/[teamId]">) {
  const { teamId } = await props.params;
  const { team, isLeader } = await requireMembership(teamId);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {team.name} {team.tag && <span className="text-muted">[{team.tag}]</span>}
          </h1>
          {team.primeLeagueUrl && (
            <a href={team.primeLeagueUrl} target="_blank" rel="noreferrer" className="link text-sm">
              Prime League Team-Seite
            </a>
          )}
        </div>
        <nav className="flex gap-4 text-sm">
          <Link href={`/teams/${team.id}`} className="link">
            Spieltage
          </Link>
          {isLeader && (
            <Link href={`/teams/${team.id}/settings`} className="link">
              Einstellungen
            </Link>
          )}
        </nav>
      </div>
      {props.children}
    </div>
  );
}
