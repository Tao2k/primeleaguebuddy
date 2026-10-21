import { redirect } from "next/navigation";
import { devLoginEnabled, discordClient, getCurrentUser } from "@/lib/auth";
import { devLogin } from "./actions";
import { safeNextPath } from "./next-path";

const ERRORS: Record<string, string> = {
  state: "Die Anmeldung ist abgelaufen. Bitte versuch es noch einmal.",
  discord: "Discord hat die Anmeldung abgelehnt. Bitte versuch es noch einmal.",
};

export default async function LoginPage(props: PageProps<"/login">) {
  const query = await props.searchParams;
  const next = safeNextPath(typeof query.next === "string" ? query.next : null);
  if (await getCurrentUser()) redirect(next);
  const error = typeof query.error === "string" ? ERRORS[query.error] : undefined;
  const discordReady = discordClient() !== null;

  return (
    <div className="mx-auto max-w-sm space-y-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold">Anmelden</h1>
        <p className="mt-2 text-sm text-muted">
          Melde dich mit Discord an, um dein Team zu verwalten und Termine abzustimmen.
        </p>
      </div>
      {error && <p className="rounded-md bg-red-500/10 p-3 text-sm text-red-600">{error}</p>}
      {discordReady ? (
        <a href={`/login/discord?next=${encodeURIComponent(next)}`} className="btn-primary block w-full text-center">
          Mit Discord anmelden
        </a>
      ) : (
        <p className="card text-sm text-muted">
          Discord-Login ist noch nicht eingerichtet. Trage DISCORD_CLIENT_ID und DISCORD_CLIENT_SECRET in die .env ein.
        </p>
      )}
      {devLoginEnabled() && (
        <form action={devLogin} className="card space-y-3">
          <p className="text-sm font-medium">Entwicklungs-Login (nur lokal)</p>
          <input type="hidden" name="next" value={next} />
          <input name="name" required placeholder="Name" className="input w-full" />
          <button className="btn-secondary w-full">Als Testnutzer anmelden</button>
        </form>
      )}
    </div>
  );
}
