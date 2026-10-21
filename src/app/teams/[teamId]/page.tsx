import Link from "next/link";
import { requireMembership } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/roles";
import { formatDateTime, formatDay, toDayInput } from "@/lib/time";
import { ErrorBanner } from "@/components/error-banner";
import { createMatchday } from "../actions";

export default async function TeamPage(props: PageProps<"/teams/[teamId]">) {
  const { teamId } = await props.params;
  const searchParams = await props.searchParams;
  const { isLeader } = await requireMembership(teamId);

  const [matchdays, members] = await Promise.all([
    db.matchday.findMany({
      where: { teamId },
      include: { confirmedSlot: true, _count: { select: { slots: true } } },
      orderBy: { windowStart: "asc" },
    }),
    db.membership.findMany({ where: { teamId }, include: { user: true }, orderBy: { joinedAt: "asc" } }),
  ]);
  const now = new Date();
  const upcoming = matchdays.filter((m) => m.windowEnd >= now);
  const past = matchdays.filter((m) => m.windowEnd < now).reverse();

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_16rem]">
      <div className="space-y-6">
        <ErrorBanner searchParams={searchParams} />
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Anstehende Spieltage</h2>
          {upcoming.length === 0 ? (
            <p className="text-muted">
              Keine anstehenden Spieltage.{isLeader ? " Leg unten einen an." : " Der Teamleiter legt sie an."}
            </p>
          ) : (
            <MatchdayList teamId={teamId} matchdays={upcoming} />
          )}
        </section>

        {isLeader && (
          <section className="card space-y-4">
            <h2 className="text-lg font-semibold">Spieltag anlegen</h2>
            <form action={createMatchday.bind(null, teamId)} className="grid gap-3 sm:grid-cols-2">
              <label className="label">
                Name
                <input name="title" required placeholder="Spieltag 1" className="input mt-1 w-full" />
              </label>
              <label className="label">
                Gegner
                <input name="opponentName" className="input mt-1 w-full" />
              </label>
              <label className="label sm:col-span-2">
                Link zum Gegner oder Match auf primeleague.gg (optional)
                <input name="opponentUrl" type="url" className="input mt-1 w-full" />
              </label>
              <label className="label">
                Spielbar ab
                <input name="windowStart" type="date" required defaultValue={toDayInput(now)} className="input mt-1 w-full" />
              </label>
              <label className="label">
                Spielbar bis
                <input name="windowEnd" type="date" required className="input mt-1 w-full" />
              </label>
              <label className="label sm:col-span-2">
                Frist für Terminvorschläge an den Gegner (optional)
                <input name="proposalDeadline" type="datetime-local" className="input mt-1 w-full" />
              </label>
              <div className="sm:col-span-2">
                <button className="btn-primary">Spieltag anlegen</button>
              </div>
            </form>
          </section>
        )}

        {past.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-muted">Vergangene Spieltage</h2>
            <MatchdayList teamId={teamId} matchdays={past} />
          </section>
        )}
      </div>

      <aside className="space-y-3">
        <h2 className="text-lg font-semibold">Team ({members.length})</h2>
        <ul className="card divide-y divide-border p-0">
          {members.map(({ id, role, user }) => (
            <li key={id} className="px-4 py-2 text-sm">
              <span className="font-medium">{user.name}</span>
              {role === "LEADER" && <span className="ml-2 text-xs text-accent">Teamleiter</span>}
              <span className="block text-xs text-muted">
                {[user.mainRole && ROLE_LABELS[user.mainRole], user.riotId].filter(Boolean).join(" · ") || "Keine Rolle / Riot ID"}
              </span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

type MatchdayRow = {
  id: string;
  title: string;
  opponentName: string | null;
  windowStart: Date;
  windowEnd: Date;
  confirmedSlot: { startsAt: Date } | null;
  _count: { slots: number };
};

function MatchdayList({ teamId, matchdays }: { teamId: string; matchdays: MatchdayRow[] }) {
  return (
    <ul className="space-y-2">
      {matchdays.map((m) => (
        <li key={m.id}>
          <Link href={`/teams/${teamId}/matchdays/${m.id}`} className="card flex flex-wrap items-center justify-between gap-2 hover:border-accent">
            <span>
              <span className="font-medium">{m.title}</span>
              {m.opponentName && <span className="text-muted"> gegen {m.opponentName}</span>}
              <span className="block text-xs text-muted">
                {formatDay(m.windowStart)} bis {formatDay(m.windowEnd)}
              </span>
            </span>
            <span className="text-sm">
              {m.confirmedSlot ? (
                <span className="font-medium text-accent">{formatDateTime(m.confirmedSlot.startsAt)}</span>
              ) : (
                <span className="text-muted">
                  {m._count.slots} {m._count.slots === 1 ? "Slot" : "Slots"}, noch offen
                </span>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
