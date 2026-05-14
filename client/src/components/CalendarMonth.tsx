import { useMemo, useState } from "react";
import type { TournamentEvent } from "@shared/schema";
import {
  addMonths,
  fmtMonthYear,
  fmtRange,
  isInRange,
  monthGridDays,
  parseISODate,
  toIso,
  type YM,
} from "@/lib/dates";
import { ChevronLeft, ChevronRight, MapPin, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Props {
  events: TournamentEvent[];
  initial: YM;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function sourceLabel(source: TournamentEvent["source"]): string {
  if (source === "TFAA") return "TFAA";
  if (source === "ASA") return "Texas ASA";
  return "TSAA";
}

function sourcePillClass(source: TournamentEvent["source"]): string {
  if (source === "TFAA") return "pill-tfaa";
  if (source === "ASA") return "pill-asa";
  return "pill-tsaa";
}

function sourceBarClass(source: TournamentEvent["source"]): string {
  if (source === "TFAA") return "event-bar-tfaa";
  if (source === "ASA") return "event-bar-asa";
  return "event-bar-tsaa";
}

export function CalendarMonth({ events, initial }: Props) {
  const [cursor, setCursor] = useState<YM>(initial);

  const days = useMemo(() => monthGridDays(cursor), [cursor]);

  const byDay = useMemo(() => {
    const map = new Map<string, TournamentEvent[]>();
    for (const ev of events) {
      // Add a copy of each event onto each day in its range
      const start = ev.startDate;
      const end = ev.endDate;
      // expand
      const s = parseISODate(start);
      const e = parseISODate(end);
      for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        const key = toIso(d);
        const arr = map.get(key) ?? [];
        arr.push(ev);
        map.set(key, arr);
      }
    }
    return map;
  }, [events]);

  const monthLabel = fmtMonthYear(new Date(cursor.year, cursor.month, 1));
  const todayIso = toIso(new Date());

  return (
    <div className="rounded-xl border border-card-border bg-card shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-card-border">
        <h2 className="text-xl font-semibold" data-testid="text-month-label">
          {monthLabel}
        </h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCursor(addMonths(cursor, -1))}
            data-testid="button-prev-month"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const d = new Date();
              setCursor({ year: d.getFullYear(), month: d.getMonth() });
            }}
            data-testid="button-today"
          >
            Today
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCursor(addMonths(cursor, 1))}
            data-testid="button-next-month"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-card-border text-xs uppercase tracking-wider text-muted-foreground">
        {WEEKDAYS.map((w) => (
          <div key={w} className="px-2 py-2 text-center">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 grid-rows-6">
        {days.map((d, i) => {
          const iso = toIso(d);
          const inMonth = d.getMonth() === cursor.month;
          const dayEvents = (byDay.get(iso) ?? []).slice(0, 3);
          const overflow = (byDay.get(iso)?.length ?? 0) - dayEvents.length;
          const isToday = iso === todayIso;
          return (
            <div
              key={i}
              className={`min-h-[108px] sm:min-h-[140px] border-b border-r border-card-border/70 px-1.5 py-1.5 flex flex-col gap-1 ${
                inMonth ? "bg-card" : "bg-muted/40 text-muted-foreground"
              } ${(i + 1) % 7 === 0 ? "border-r-0" : ""} ${
                i >= 35 ? "border-b-0" : ""
              }`}
              data-testid={`cell-day-${iso}`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex items-center justify-center text-xs font-medium ${
                    isToday
                      ? "h-6 w-6 rounded-full bg-primary text-primary-foreground"
                      : ""
                  }`}
                >
                  {d.getDate()}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {dayEvents.map((ev) => {
                  const isStart = ev.startDate === iso;
                  return (
                    <Popover key={`${ev.id}-${iso}`}>
                      <PopoverTrigger asChild>
                        <button
                          className={`text-left text-[10px] sm:text-[11px] font-medium leading-tight rounded px-1.5 py-1 whitespace-normal break-words hover-elevate-2 ${sourceBarClass(ev.source)}`}
                          data-testid={`event-bar-${ev.id}-${iso}`}
                          title={ev.name}
                        >
                          {ev.name}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-72"
                        align="start"
                        side="bottom"
                      >
                        <EventPopover event={ev} />
                      </PopoverContent>
                    </Popover>
                  );
                })}
                {overflow > 0 && (
                  <span className="text-[10px] text-muted-foreground px-1">
                    +{overflow} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventPopover({ event }: { event: TournamentEvent }) {
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase ${
            sourcePillClass(event.source)
          }`}
        >
          {sourceLabel(event.source)}
        </span>
      </div>
      <h3 className="text-base font-semibold leading-snug">{event.name}</h3>
      <p className="text-sm text-muted-foreground">
        {fmtRange(event.startDate, event.endDate)}
      </p>
      {event.location && (
        <div className="flex items-start gap-1.5 text-sm">
          <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
          <span>{event.location}</span>
        </div>
      )}
      {event.contact && (
        <p className="text-xs text-muted-foreground">
          Contact: <span className="text-foreground">{event.contact}</span>
        </p>
      )}
      {event.phone && (
        <p className="text-xs text-muted-foreground">
          Phone: <span className="text-foreground">{event.phone}</span>
        </p>
      )}
      {event.email && (
        <p className="text-xs text-muted-foreground truncate">
          Email:{" "}
          <a
            href={`mailto:${event.email}`}
            className="text-foreground underline underline-offset-2"
          >
            {event.email}
          </a>
        </p>
      )}
      {event.registrationStart && event.registrationEnd && (
        <p className="text-xs text-muted-foreground">
          Registration:{" "}
          <span className="text-foreground">
            {fmtRange(event.registrationStart, event.registrationEnd)}
          </span>
        </p>
      )}
      <a
        href={event.sourceUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline pt-1"
      >
        View on {sourceLabel(event.source)} schedule
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}
