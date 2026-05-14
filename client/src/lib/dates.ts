// Date helpers that work on plain ISO strings (YYYY-MM-DD) without timezone drift.

export interface YM {
  year: number;
  month: number; // 0-11
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

export function fmtMonthYear(d: Date): string {
  return d.toLocaleString("en-US", { month: "long", year: "numeric" });
}

export function fmtRange(startIso: string, endIso: string): string {
  const s = parseISODate(startIso);
  const e = parseISODate(endIso);
  if (startIso === endIso) {
    return s.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  const sameMonth =
    s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth();
  if (sameMonth) {
    return `${s.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })}–${e.getDate()}, ${e.getFullYear()}`;
  }
  return `${s.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} – ${e.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

export function fmtRelative(iso: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return `${Math.floor(diff / 86400)} d ago`;
}

export function addMonths({ year, month }: YM, delta: number): YM {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

// Returns 6 weeks (42 days) starting from the Sunday on/before the 1st.
export function monthGridDays({ year, month }: YM): Date[] {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const out: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push(d);
  }
  return out;
}

export function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isInRange(day: string, start: string, end: string): boolean {
  return day >= start && day <= end;
}
