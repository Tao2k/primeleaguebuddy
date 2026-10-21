import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEFAULT_RULES } from "@/lib/scheduling";
import { formatClock, weekdayLabel } from "@/lib/time";
import { ErrorBanner } from "@/components/error-banner";
import { removeMember, renewInviteCode, setMemberRole, updateRules, updateTeam } from "../../actions";

export default async function TeamSettingsPage(props: PageProps<"/teams/[teamId]/settings">) {
  const { teamId } = await props.params;
  const searchParams = await props.searchParams;
  const { team, membership: own, isLeader } = await requireMembership(teamId);
  if (!isLeader) redirect(`/teams/${teamId}`);

  const [rules, members] = await Promise.all([
    db.ruleProfile.findUnique({ where: { teamId } }),
    db.membership.findMany({ where: { teamId }, include: { user: true }, orderBy: { joinedAt: "asc" } }),
  ]);
  const r = rules ?? DEFAULT_RULES;
  const inviteUrl = `${process.env.APP_URL ?? ""}/join/${team.inviteCode}`;

  return (
    <div className="space-y-6">
      <ErrorBanner searchParams={searchParams} />
      {searchParams.saved && <p className="text-sm text-accent">Gespeichert.</p>}

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">Mitglieder einladen</h2>
        <p className="text-sm text-muted">Schick diesen Link an deine Teammitglieder. Wer ihn hat, kann dem Team beitreten.</p>
        <input readOnly value={inviteUrl} className="input w-full font-mono text-xs" />
        <form action={renewInviteCode.bind(null, teamId)}>
          <button className="btn-secondary">Neuen Link erzeugen (alter Link wird ungültig)</button>
        </form>
      </section>

      <section className="card space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Regelprofil für die Terminplanung</h2>
          <p className="text-sm text-muted">
            Trag hier die Vorgaben aus dem aktuellen Prime League Regelwerk ein. Neue Zeitslots werden dagegen geprüft. Alle
            Zeiten in deutscher Zeit.
          </p>
        </div>
        <form action={updateRules.bind(null, teamId)} className="space-y-4">
          <fieldset>
            <legend className="label">Erlaubte Spieltage</legend>
            <div className="mt-2 flex flex-wrap gap-3">
              {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                <label key={day} className="flex items-center gap-1 text-sm">
                  <input type="checkbox" name="allowedWeekdays" value={day} defaultChecked={r.allowedWeekdays.includes(day)} />
                  {weekdayLabel(day)}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="label">
              Frühester Spielbeginn
              <input name="earliestStart" type="time" required defaultValue={formatClock(r.earliestStartMinutes)} className="input mt-1 w-full" />
            </label>
            <label className="label">
              Spätester Spielbeginn
              <input name="latestStart" type="time" required defaultValue={formatClock(r.latestStartMinutes)} className="input mt-1 w-full" />
            </label>
            <label className="label">
              Mindestanzahl Spieler
              <input name="minPlayers" type="number" min={1} max={10} required defaultValue={r.minPlayers} className="input mt-1 w-full" />
            </label>
            <label className="label">
              Anzahl Terminvorschläge an den Gegner
              <input name="proposalCount" type="number" min={1} max={10} required defaultValue={r.proposalCount} className="input mt-1 w-full" />
            </label>
          </div>
          <button className="btn-primary">Regeln speichern</button>
        </form>
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">Team</h2>
        <form action={updateTeam.bind(null, teamId)} className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <label className="label">
            Teamname
            <input name="name" required defaultValue={team.name} className="input mt-1 w-full" />
          </label>
          <label className="label">
            Kürzel
            <input name="tag" maxLength={8} defaultValue={team.tag ?? ""} className="input mt-1 w-full" />
          </label>
          <label className="label sm:col-span-2">
            Link zur Prime League Team-Seite
            <input name="primeLeagueUrl" type="url" defaultValue={team.primeLeagueUrl ?? ""} className="input mt-1 w-full" />
          </label>
          <div className="sm:col-span-2">
            <button className="btn-primary">Speichern</button>
          </div>
        </form>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">Mitglieder verwalten</h2>
        <ul className="divide-y divide-border">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span>
                {m.user.name}
                {m.role === "LEADER" && <span className="ml-2 text-xs text-accent">Teamleiter</span>}
              </span>
              <span className="flex gap-2">
                {m.role === "MEMBER" ? (
                  <form action={setMemberRole.bind(null, teamId, m.id, "LEADER")}>
                    <button className="btn-small">Zum Teamleiter machen</button>
                  </form>
                ) : (
                  <form action={setMemberRole.bind(null, teamId, m.id, "MEMBER")}>
                    <button className="btn-small">Teamleiter entfernen</button>
                  </form>
                )}
                {m.id !== own.id && (
                  <form action={removeMember.bind(null, teamId, m.id)}>
                    <button className="btn-small text-red-600">Aus Team entfernen</button>
                  </form>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
