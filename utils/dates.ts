import { addDays, addMonths, differenceInCalendarDays, format, parseISO, startOfMonth, endOfMonth, subMonths } from "date-fns";
import type { MembershipStatus } from "@/types";

/** All dates in the sheets are plain "yyyy-MM-dd" strings in the gym's timezone. */
export const fmt = (d: Date) => format(d, "yyyy-MM-dd");
export const parse = (s: string) => parseISO(s);

/** Today's calendar date in the given IANA timezone. */
export function todayIn(tz: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export const addDaysStr = (s: string, n: number) => fmt(addDays(parse(s), n));

/**
 * Last valid day of a membership starting at `start`.
 * date-fns addMonths clamps month-ends (Jan 31 + 1 month = Feb 28/29) and handles leap years.
 * A 1-month plan starting Jan 1 ends Jan 31 (inclusive), so the next one starts Feb 1.
 */
export function computeExpiry(start: string, value: number, unit: "day" | "month"): string {
  const s = parse(start);
  const end = unit === "month" ? addMonths(s, value) : addDays(s, value);
  return fmt(addDays(end, -1));
}

export const daysBetween = (from: string, to: string) => differenceInCalendarDays(parse(to), parse(from));

/** Status is derived from dates, so a late cron never shows stale data. */
export function computeStatus(expiry: string, today: string, graceDays: number): MembershipStatus {
  if (!expiry) return "Inactive";
  const past = daysBetween(expiry, today);
  if (past <= 0) return "Active";
  return past <= graceDays ? "Expired" : "Inactive";
}

export function monthKey(dateStr: string) { return dateStr.slice(0, 7); }
export function monthRange(ym: string) { const d = parse(`${ym}-01`); return { from: fmt(startOfMonth(d)), to: fmt(endOfMonth(d)) }; }
export function previousMonthKey(today: string) { return format(subMonths(parse(today), 1), "yyyy-MM"); }

export function resolveRange(range: string, today: string, from?: string, to?: string): { from: string; to: string } {
  const t = parse(today);
  switch (range) {
    case "last-month": { const m = subMonths(t, 1); return { from: fmt(startOfMonth(m)), to: fmt(endOfMonth(m)) }; }
    case "3m": return { from: fmt(startOfMonth(subMonths(t, 2))), to: fmt(endOfMonth(t)) };
    case "6m": return { from: fmt(startOfMonth(subMonths(t, 5))), to: fmt(endOfMonth(t)) };
    case "year": return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
    case "custom": return { from: from || today, to: to || today };
    default: return { from: fmt(startOfMonth(t)), to: fmt(endOfMonth(t)) };
  }
}
export const inRange = (d: string, r: { from: string; to: string }) => !!d && d >= r.from && d <= r.to;
