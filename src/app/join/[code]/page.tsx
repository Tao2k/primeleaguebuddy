import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { joinTeam } from "@/app/teams/actions";

export default async function JoinPage(props: PageProps<"/join/[code]">) {
  const { code } = await props.params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/join/${code}`)}`);

  const team = await db.team.findUnique({ where: { inviteCode: code }, include: { _count: { select: { memberships: true } } } });
  if (!team) {
    return (
      <div className="card mx-auto max-w-md space-y-2">
        <h1 className="text-xl font-semibold">Einladung ungültig</h1>
        <p className="text-muted">Der Link ist falsch oder wurde vom Teamleiter erneuert. Frag nach einem neuen Link.</p>
      </div>
    );
  }
  const alreadyMember = await db.membership.findUnique({ where: { userId_teamId: { userId: user.id, teamId: team.id } } });
  if (alreadyMember) redirect(`/teams/${team.id}`);

  return (
    <div className="card mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-semibold">
        {team.name} {team.tag && <span className="text-muted">[{team.tag}]</span>}
      </h1>
      <p className="text-muted">
        Du wurdest in dieses Team eingeladen. Es hat {team._count.memberships}{" "}
        {team._count.memberships === 1 ? "Mitglied" : "Mitglieder"}.
      </p>
      <form action={joinTeam.bind(null, code)}>
        <button className="btn-primary">Team beitreten</button>
      </form>
    </div>
  );
}
