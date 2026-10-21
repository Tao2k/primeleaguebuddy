import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/roles";
import { DEFAULT_RULES, rankSlots, type Answer, type RankedSlot } from "@/lib/scheduling";
import { formatClock, formatDateTime, formatDay, weekdayLabel } from "@/lib/time";
import { ErrorBanner } from "@/components/error-banner";
import { addSlot, confirmSlot, deleteMatchday, deleteSlot, vote } from "@/app/teams/actions";

const ANSWERS: { value: Answer; label: string }[] = [
  { value: "YES", label: "Kann" },
  { value: "MAYBE", label: "Vielleicht" },
  { value: "NO", label: "Kann nicht" },
];

export default async function MatchdayPage(props: PageProps<"/teams/[teamId]/matchdays/[matchdayId]">) {
  const { teamId, matchdayId } = await props.params;
  const searchParams = await props.searchParams;
  const { user, isLeader } = await requireMembership(teamId);

  const [matchday, rulesRow, memberships] = await Promise.all([
    db.matchday.findUnique({
      where: { id: matchdayId, teamId },
      include: { slots: { include: { votes: true } } },
    }),
    db.ruleProfile.findUnique({ where: { teamId } }),
    db.membership.findMany({ where: { teamId }, include: { user: true }, orderBy: { joinedAt: "asc" } }),
  ]);
  if (!matchday) redirect(`/teams/${teamId}`);
  const rules = rulesRow ?? DEFAULT_RULES;
  const members = memberships.map((m) => ({ userId: m.userId, name: m.user.name, mainRole: m.user.mainRole }));
  const ranked = rankSlots(matchday.slots, members, rules);
  const myVotes = new Map(
    matchday.slots.flatMap((s) => s.votes.filter((v) => v.userId === user.id).map((v) => [s.id, v.answer] as const)),
  );
  const creators = new Map(matchday.slots.map((s) => [s.id, s.createdById]));
  const confirmed = ranked.find((s) => s.id === matchday.confirmedSlotId);
  const recommended = ranked.filter((s) => s.recommended);
  const deadlinePassed = matchday.proposalDeadline !== null && matchday.proposalDeadline < new Date();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">
            {matchday.title}
            {matchday.opponentName && <span className="font-normal text-muted"> gegen {matchday.opponentName}</span>}
          </h2>
          <p className="text-sm text-muted">
            Spielbar {formatDay(matchday.windowStart)} bis {formatDay(matchday.windowEnd)}
            {matchday.opponentUrl && (
              <>
                {" · "}
                <a href={matchday.opponentUrl} target="_blank" rel="noreferrer" className="link">
                  Gegner auf primeleague.gg
                </a>
              </>
            )}
          </p>
          {matchday.proposalDeadline && (
            <p className={`text-sm ${deadlinePassed ? "text-red-600" : "text-muted"}`}>
              Frist für Terminvorschläge: {formatDateTime(matchday.proposalDeadline)}
              {deadlinePassed && " (abgelaufen)"}
            </p>
          )}
        </div>
        {isLeader && (
          <form action={deleteMatchday.bind(null, teamId, matchdayId)}>
            <button className="btn-small text-red-600">Spieltag löschen</button>
          </form>
        )}
      </div>

      <ErrorBanner searchParams={searchParams} />

      {confirmed && (
        <div className="card border-accent">
          <p className="text-sm text-muted">Vereinbarter Termin</p>
          <p className="text-lg font-semibold text-accent">{formatDateTime(confirmed.startsAt)}</p>
          <p className="text-sm text-muted">
            {confirmed.yes.length} Zusagen: {confirmed.yes.map((m) => m.name).join(", ") || "noch keine"}
          </p>
        </div>
      )}

      {!confirmed && recommended.length > 0 && (
        <div className="card space-y-2">
          <h3 className="font-semibold">Vorschläge für den Gegner</h3>
          <p className="text-sm text-muted">
            {recommended.length === 1
              ? "Der beste Slot nach Zusagen. Trag ihn als Terminvorschlag auf primeleague.gg ein."
              : `Die besten ${recommended.length} Slots nach Zusagen. Trag sie als Terminvorschläge auf primeleague.gg ein.`}
          </p>
          <ol className="list-decimal pl-5 text-sm">
            {recommended.map((s) => (
              <li key={s.id}>
                {formatDateTime(s.startsAt)} ({s.yes.length} Zusagen{s.maybe.length > 0 && `, ${s.maybe.length} vielleicht`})
              </li>
            ))}
          </ol>
        </div>
      )}

      <section className="card space-y-3">
        <h3 className="font-semibold">Zeitslot vorschlagen</h3>
        <p className="text-sm text-muted">
          Erlaubt laut Regelprofil: {rules.allowedWeekdays.map(weekdayLabel).join(", ")}, Beginn{" "}
          {formatClock(rules.earliestStartMinutes)} bis {formatClock(rules.latestStartMinutes)} Uhr.
        </p>
        <form action={addSlot.bind(null, teamId, matchdayId)} className="flex flex-wrap gap-2">
          <input name="startsAt" type="datetime-local" required step={900} className="input" />
          <button className="btn-primary">Slot hinzufügen</button>
        </form>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold">Zeitslots ({ranked.length}), beste zuerst</h3>
        {ranked.length === 0 && <p className="text-muted">Noch keine Slots. Schlag oben den ersten vor.</p>}
        <ul className="space-y-3">
          {ranked.map((slot) => (
            <SlotCard
              key={slot.id}
              slot={slot}
              teamId={teamId}
              matchdayId={matchdayId}
              myAnswer={myVotes.get(slot.id)}
              isConfirmed={slot.id === matchday.confirmedSlotId}
              canDelete={isLeader || creators.get(slot.id) === user.id}
              isLeader={isLeader}
              minPlayers={rules.minPlayers}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}

function SlotCard(props: {
  slot: RankedSlot;
  teamId: string;
  matchdayId: string;
  myAnswer: Answer | undefined;
  isConfirmed: boolean;
  canDelete: boolean;
  isLeader: boolean;
  minPlayers: number;
}) {
  const { slot, teamId, matchdayId } = props;
  const status = slot.confirmed
    ? { text: "Spielbar", className: "bg-accent/15 text-accent" }
    : slot.possible
      ? { text: "Möglich, wenn die Vielleichts zusagen", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" }
      : { text: `Zu wenige Spieler (min. ${props.minPlayers})`, className: "bg-red-500/10 text-red-600 dark:text-red-400" };

  return (
    <li className={`card space-y-3 ${props.isConfirmed ? "border-accent" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{formatDateTime(slot.startsAt)}</span>
          <span className={`rounded px-2 py-0.5 text-xs ${status.className}`}>{status.text}</span>
          {slot.recommended && !props.isConfirmed && (
            <span className="rounded bg-accent px-2 py-0.5 text-xs text-accent-foreground">Vorschlag</span>
          )}
        </div>
        <div className="flex gap-2">
          {props.isLeader &&
            (props.isConfirmed ? (
              <form action={confirmSlot.bind(null, teamId, matchdayId, null)}>
                <button className="btn-small">Festlegung aufheben</button>
              </form>
            ) : (
              <form action={confirmSlot.bind(null, teamId, matchdayId, slot.id)}>
                <button className="btn-small">Als Termin festlegen</button>
              </form>
            ))}
          {props.canDelete && (
            <form action={deleteSlot.bind(null, teamId, matchdayId, slot.id)}>
              <button className="btn-small text-red-600">Löschen</button>
            </form>
          )}
        </div>
      </div>

      <dl className="grid gap-1 text-sm sm:grid-cols-2">
        <VoteGroup label="Kann" members={slot.yes} />
        <VoteGroup label="Vielleicht" members={slot.maybe} />
        <VoteGroup label="Kann nicht" members={slot.no} />
        <VoteGroup label="Noch nicht abgestimmt" members={slot.pending} />
      </dl>
      {slot.missingRoles.length > 0 && slot.yes.length > 0 && (
        <p className="text-xs text-muted">Fehlende Rollen: {slot.missingRoles.map((r) => ROLE_LABELS[r]).join(", ")}</p>
      )}

      <div className="flex flex-wrap gap-2">
        {ANSWERS.map((a) => (
          <form key={a.value} action={vote.bind(null, teamId, matchdayId, slot.id, a.value)}>
            <button
              className={props.myAnswer === a.value ? "btn-primary" : "btn-secondary"}
              aria-pressed={props.myAnswer === a.value}
            >
              {a.label}
            </button>
          </form>
        ))}
      </div>
    </li>
  );
}

function VoteGroup({ label, members }: { label: string; members: { userId: string; name: string }[] }) {
  return (
    <div>
      <dt className="inline text-muted">
        {label} ({members.length}):{" "}
      </dt>
      <dd className="inline">{members.map((m) => m.name).join(", ") || "–"}</dd>
    </div>
  );
}
