import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ErrorBanner } from "@/components/error-banner";
import { createTeam } from "./teams/actions";

export default async function HomePage(props: PageProps<"/">) {
  const user = await requireUser();
  const searchParams = await props.searchParams;
  const memberships = await db.membership.findMany({
    where: { userId: user.id },
    include: { team: true },
    orderBy: { joinedAt: "asc" },
  });

  return (
    <div className="space-y-8">
      <ErrorBanner searchParams={searchParams} />
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">Deine Teams</h1>
        {memberships.length === 0 ? (
          <p className="text-muted">
            Du bist noch in keinem Team. Leg unten ein Team an oder öffne den Einladungslink deines Teamleiters.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {memberships.map(({ team, role }) => (
              <li key={team.id}>
                <Link href={`/teams/${team.id}`} className="card block hover:border-accent">
                  <span className="font-medium">
                    {team.name} {team.tag && <span className="text-muted">[{team.tag}]</span>}
                  </span>
                  <span className="mt-1 block text-sm text-muted">{role === "LEADER" ? "Teamleiter" : "Mitglied"}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">Neues Team anlegen</h2>
        <form action={createTeam} className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <label className="label">
            Teamname
            <input name="name" required className="input mt-1 w-full" />
          </label>
          <label className="label">
            Kürzel
            <input name="tag" maxLength={8} className="input mt-1 w-full" />
          </label>
          <label className="label sm:col-span-2">
            Link zur Prime League Team-Seite (optional)
            <input
              name="primeLeagueUrl"
              type="url"
              placeholder="https://www.primeleague.gg/de/leagues/teams/..."
              className="input mt-1 w-full"
            />
          </label>
          <div className="sm:col-span-2">
            <button className="btn-primary">Team anlegen</button>
          </div>
        </form>
      </section>
    </div>
  );
}
