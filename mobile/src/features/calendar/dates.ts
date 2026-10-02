// Date helpers that work on plain ISO strings (YYYY-MM-DD) without timezone drift.
// Ported from client/src/lib/dates.ts on the website.

export interface YM {
  year: number;
  month: number; // 0-11
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

export function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function monthName(month: number): string {
  return MONTHS[month];
}

export function monthShort(month: number): string {
  return MONTHS_SHORT[month];
}

export function fmtMonthYear(ym: YM): string {
  return `${MONTHS[ym.month]} ${ym.year}`;
}

export function fmtDayLong(iso: string): string {
  const d = parseISODate(iso);
  return `${WEEKDAYS_SHORT[d.getDay()]}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

// Formatted by hand rather than with toLocaleDateString, which is inconsistent on Android.
export function fmtRange(startIso: string, endIso: string): string {
  const s = parseISODate(startIso);
  const e = parseISODate(endIso);
  if (startIso === endIso) {
    return `${WEEKDAYS_SHORT[s.getDay()]}, ${MONTHS_SHORT[s.getMonth()]} ${s.getDate()}, ${s.getFullYear()}`;
  }
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
    return `${MONTHS_SHORT[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${e.getFullYear()}`;
  }
  if (s.getFullYear() === e.getFullYear()) {
    return `${MONTHS_SHORT[s.getMonth()]} ${s.getDate()} – ${MONTHS_SHORT[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
  }
  return `${MONTHS_SHORT[s.getMonth()]} ${s.getDate()}, ${s.getFullYear()} – ${MONTHS_SHORT[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
}

export function fmtRelative(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (!isFinite(diff)) return "";
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  const days = Math.floor(diff / 86400);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function addMonths({ year, month }: YM, delta: number): YM {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function currentYM(): YM {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() };
}

// 6 weeks (42 days) starting from the Sunday on/before the 1st.
export function monthGridDays({ year, month }: YM): Date[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const out: Date[] = [];
  for (let i = 0; i < 42; i++) {
    out.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }
  return out;
}

// Every ISO day from start to end, inclusive. Capped so a bad date can't loop forever.
export function daysInRange(startIso: string, endIso: string): string[] {
  const out: string[] = [];
  const s = parseISODate(startIso);
  const end = endIso < startIso ? startIso : endIso;
  for (let i = 0; i < 31; i++) {
    const iso = toIso(new Date(s.getFullYear(), s.getMonth(), s.getDate() + i));
    out.push(iso);
    if (iso >= end) break;
  }
  return out;
}

// Days from today until the given ISO date (0 = today, negative = past).
export function daysUntil(iso: string): number {
  const today = parseISODate(toIso(new Date()));
  return Math.round((parseISODate(iso).getTime() - today.getTime()) / 86400000);
}
