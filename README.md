# PrimeLeague Buddy

Web-App für Prime League Teams: Spieltermine regelkonform planen und (bald) den Gegner scouten.

## Was schon geht

- **Login mit Discord**, Team anlegen, Mitglieder per Einladungslink aufnehmen, Teamleiter-Rolle.
- **Spieltage** mit Spielzeitraum, Gegner und Frist für Terminvorschläge.
- **Zeitslots:** Jedes Mitglied schlägt Slots vor und stimmt mit Kann / Vielleicht / Kann nicht ab.
- **Regelprofil pro Team:** erlaubte Wochentage, frühester und spätester Spielbeginn, Mindestanzahl Spieler, Anzahl Terminvorschläge. Neue Slots werden dagegen geprüft. Die Werte aus dem aktuellen Prime League Regelwerk trägt der Teamleiter unter *Einstellungen* ein.
- **Ranking:** Slots mit genug Zusagen und besetzten Rollen stehen oben, die besten werden als Vorschläge für den Gegner markiert. Der Teamleiter legt den finalen Termin fest.

Alle Zeiten sind deutsche Zeit (Europe/Berlin).

## Geplant

1. SoloQ-Scouting über die Riot API (meistgespielte Champions pro Gegner-Spieler, Link zu op.gg)
2. Prime League Scouting (Picks aus Prime League Spielen, Spielplan-Import)
3. Discord-Erinnerungen und Kalender-Export

## Lokal starten

Voraussetzungen: Node.js 22 und eine PostgreSQL-Datenbank.

```bash
cp .env.example .env       # DATABASE_URL anpassen
npm install
npm run db:migrate         # Tabellen anlegen
npm run dev                # http://localhost:3000
```

Ohne Discord-Zugangsdaten kann man sich lokal mit dem Entwicklungs-Login (`DEV_LOGIN="true"`) unter beliebigem Namen anmelden. Für den echten Login eine App im [Discord Developer Portal](https://discord.com/developers/applications) anlegen, als Redirect `<APP_URL>/login/discord/callback` eintragen und Client-ID und Secret in die `.env` schreiben.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Technik

Next.js 16 (App Router, Server Actions), TypeScript, Tailwind CSS, PostgreSQL mit Prisma 7, Discord OAuth über [arctic](https://arcticjs.dev), Sessions in der Datenbank.
