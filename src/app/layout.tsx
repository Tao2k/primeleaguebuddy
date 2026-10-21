import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { logout } from "./login/actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "PrimeLeague Buddy",
  description: "Termine planen und Gegner scouten für Prime League Teams",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  return (
    <html lang="de" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="font-semibold">
              PrimeLeague Buddy
            </Link>
            {user && (
              <nav className="flex items-center gap-4 text-sm">
                <Link href="/profile" className="link">
                  {user.name}
                </Link>
                <form action={logout}>
                  <button className="text-muted hover:text-foreground">Abmelden</button>
                </form>
              </nav>
            )}
          </div>
        </header>
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
