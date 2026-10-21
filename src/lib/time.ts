import { TZDate } from "@date-fns/tz";

// Prime League match times are communicated in German local time.
export const TIME_ZONE = "Europe/Berlin";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;

export function weekdayLabel(isoWeekday: number): string {
  return WEEKDAYS.at(isoWeekday - 1) ?? "?";
}

/** Weekday (1 = Monday ... 7 = Sunday) and minutes after midnight in Berlin. */
export function berlinParts(date: Date): { isoWeekday: number; minutes: number } {
  const local = new TZDate(date, TIME_ZONE);
  const day = local.getDay();
  return {
    isoWeekday: day === 0 ? 7 : day,
    minutes: local.getHours() * 60 + local.getMinutes(),
  };
}

/** Parses "YYYY-MM-DDTHH:MM" (datetime-local input) as Berlin time. */
export function parseBerlinDateTime(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number);
  const date = new TZDate(y, mo - 1, d, h, mi, TIME_ZONE);
  return Number.isNaN(date.getTime()) ? null : new Date(date.getTime());
}

/** Parses "YYYY-MM-DD" (date input) as the start or end of that day in Berlin. */
export function parseBerlinDay(value: string, edge: "start" | "end"): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, mo, d] = match.map(Number);
  const date =
    edge === "start"
      ? new TZDate(y, mo - 1, d, 0, 0, 0, 0, TIME_ZONE)
      : new TZDate(y, mo - 1, d, 23, 59, 59, 999, TIME_ZONE);
  return Number.isNaN(date.getTime()) ? null : new Date(date.getTime());
}

/** "HH:MM" -> minutes after midnight. */
export function parseClock(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

export function formatClock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Value for a date input, in Berlin time. */
export function toDayInput(date: Date): string {
  const local = new TZDate(date, TIME_ZONE);
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
}

const dateTimeFormat = new Intl.DateTimeFormat("de-DE", {
  timeZone: TIME_ZONE,
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const dayFormat = new Intl.DateTimeFormat("de-DE", {
  timeZone: TIME_ZONE,
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function formatDateTime(date: Date): string {
  return `${dateTimeFormat.format(date)} Uhr`;
}

export function formatDay(date: Date): string {
  return dayFormat.format(date);
}
