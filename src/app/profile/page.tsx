import { requireUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/roles";
import { ErrorBanner } from "@/components/error-banner";
import { updateProfile } from "./actions";

export default async function ProfilePage(props: PageProps<"/profile">) {
  const user = await requireUser();
  const searchParams = await props.searchParams;
  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-semibold">Profil</h1>
      <ErrorBanner searchParams={searchParams} />
      {searchParams.saved && <p className="text-sm text-accent">Gespeichert.</p>}
      <form action={updateProfile} className="card space-y-4">
        <label className="label">
          Riot ID
          <input name="riotId" defaultValue={user.riotId ?? ""} placeholder="Name#EUW" className="input mt-1 w-full" />
        </label>
        <label className="label">
          Hauptrolle
          <select name="mainRole" defaultValue={user.mainRole ?? ""} className="input mt-1 w-full">
            <option value="">Keine Angabe</option>
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-muted">Die Hauptrolle hilft beim Ranking: Slots, bei denen alle Rollen besetzt sind, landen weiter oben.</p>
        <button className="btn-primary">Speichern</button>
      </form>
    </div>
  );
}
