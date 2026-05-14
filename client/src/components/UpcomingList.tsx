import type { TournamentEvent } from "@shared/schema";
import { fmtRange, parseISODate } from "@/lib/dates";
import { MapPin, ExternalLink, Calendar } from "lucide-react";

interface Props {
  events: TournamentEvent[];
}

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

export function UpcomingList({ events }: Props) {
  // Group by month label
  const groups: { label: string; items: TournamentEvent[] }[] = [];
  for (const ev of events) {
    const d = parseISODate(ev.startDate);
    const label = d.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    let g = groups[groups.length - 1];
    if (!g || g.label !== label) {
      g = { label, items: [] };
      groups.push(g);
    }
    g.items.push(ev);
  }

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-card-border bg-card/50 px-6 py-12 text-center">
        <Calendar className="h-8 w-8 mx-auto text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">
          No upcoming tournaments match your filters.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="list-upcoming">
      {groups.map((g) => (
        <section key={g.label}>
          <h3 className="text-sm uppercase tracking-[0.18em] text-muted-foreground font-medium mb-3">
            {g.label}
          </h3>
          <ul className="space-y-2">
            {g.items.map((ev) => (
              <li
                key={ev.id}
                className="group flex items-start gap-4 rounded-lg border border-card-border bg-card p-4 hover-elevate"
                data-testid={`row-event-${ev.id}`}
              >
                <DateBadge startIso={ev.startDate} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase ${
                        sourcePillClass(ev.source)
                      }`}
                    >
                      {sourceLabel(ev.source)}
                    </span>
                    <h4 className="text-base font-semibold leading-snug">
                      {ev.name}
                    </h4>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {fmtRange(ev.startDate, ev.endDate)}
                  </p>
                  {ev.location && (
                    <p className="mt-0.5 text-sm text-muted-foreground inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{ev.location}</span>
                    </p>
                  )}
                </div>
                <a
                  href={ev.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary self-center px-2 py-1 rounded hover-elevate"
                  aria-label={`View on ${sourceLabel(ev.source)} schedule`}
                >
                  Source <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function DateBadge({ startIso }: { startIso: string }) {
  const d = parseISODate(startIso);
  return (
    <div className="flex flex-col items-center justify-center w-14 shrink-0 rounded-md border border-card-border bg-background py-2">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {d.toLocaleString("en-US", { month: "short" })}
      </span>
      <span className="font-serif text-xl leading-none mt-0.5">
        {d.getDate()}
      </span>
    </div>
  );
}
