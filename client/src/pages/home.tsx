import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { EventsResponse, TournamentEvent } from "@shared/schema";
import { CalendarMonth } from "@/components/CalendarMonth";
import { UpcomingList } from "@/components/UpcomingList";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtRelative, parseISODate, toIso } from "@/lib/dates";
import {
  RefreshCw,
  AlertTriangle,
  CircleAlert,
  CheckCircle2,
  ExternalLink,
  Target,
  CalendarDays,
  List,
} from "lucide-react";

type SourceFilter = "all" | TournamentEvent["source"];

// Emails here are checked every few hours; verified shoots are added after review.
const SUBMIT_SHOOT_HREF =
  "mailto:cheyenne@inkboxmail.com?subject=" +
  encodeURIComponent("Add a shoot") +
  "&body=" +
  encodeURIComponent(
    "Event name:\nHost club:\nSanctioned by (ASA, NFAA/TFAA, USA Archery/TSAA, IBO, or none):\nDates:\nVenue and address:\nCity, state:\nLink to flyer, club page or registration:\nYour name, role with the club, and phone:\n"
  );

function sourceLabel(source: TournamentEvent["source"]): string {
  if (source === "TFAA") return "TFAA";
  if (source === "ASA") return "Texas ASA";
  if (source === "CLUB") return "Club shoot";
  return "TSAA";
}

function sourcePillClass(source: TournamentEvent["source"]): string {
  if (source === "TFAA") return "pill-tfaa";
  if (source === "ASA") return "pill-asa";
  if (source === "CLUB") return "pill-club";
  return "pill-tsaa";
}

function sourceBarClass(source: TournamentEvent["source"]): string {
  if (source === "TFAA") return "event-bar-tfaa";
  if (source === "ASA") return "event-bar-asa";
  if (source === "CLUB") return "event-bar-club";
  return "event-bar-tsaa";
}

export default function Home() {
  // events.json is collected every few hours by GitHub Actions
  // (.github/workflows/pages.yml) and published next to this page.
  const { data, isLoading, isError, error } = useQuery<EventsResponse>({
    queryKey: ["events.json"],
  });

  const refresh = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", `events.json?t=${Date.now()}`);
      return (await res.json()) as EventsResponse;
    },
    onSuccess: (fresh) => {
      queryClient.setQueryData(["events.json"], fresh);
    },
  });

  const [filter, setFilter] = useState<SourceFilter>("all");
  const [view, setView] = useState<"calendar" | "list">("calendar");

  const todayIso = toIso(new Date());

  const filtered = useMemo<TournamentEvent[]>(() => {
    if (!data) return [];
    return data.events.filter((e) =>
      filter === "all" ? true : e.source === filter
    );
  }, [data, filter]);

  const upcoming = useMemo(
    () => filtered.filter((e) => e.endDate >= todayIso),
    [filtered, todayIso]
  );

  const tfaaCount = data?.events.filter((e) => e.source === "TFAA").length ?? 0;
  const asaCount = data?.events.filter((e) => e.source === "ASA").length ?? 0;
  const tsaaCount = data?.events.filter((e) => e.source === "TSAA").length ?? 0;
  const clubCount = data?.events.filter((e) => e.source === "CLUB").length ?? 0;

  const initial = useMemo(() => {
    // Open the calendar on the month of the next upcoming event, falling back to today.
    if (upcoming.length > 0) {
      const d = parseISODate(upcoming[0].startDate);
      return { year: d.getFullYear(), month: d.getMonth() };
    }
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  }, [upcoming]);

  return (
    <div className="min-h-screen bg-topo">
      <header className="border-b border-border/70 bg-background/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <div className="text-primary">
            <Logo className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <h1 className="font-serif text-lg sm:text-xl font-semibold leading-tight">
              Texas Archery Calendar
            </h1>
            <p className="text-[11px] text-muted-foreground leading-tight">
              TFAA + Texas ASA + TSAA tournament schedule
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {data && (
              <span
                className="hidden sm:inline text-xs text-muted-foreground"
                data-testid="text-last-updated"
              >
                Updated {fmtRelative(data.lastUpdated)}
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => refresh.mutate()}
              disabled={refresh.isPending || isLoading}
              data-testid="button-refresh"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 mr-1.5 ${
                  refresh.isPending ? "animate-spin" : ""
                }`}
              />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-16">
        <section className="mb-8">
          <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-primary font-semibold">
            <Target className="h-3.5 w-3.5" />
            Texas tournament season
          </p>
          <h2 className="mt-3 font-serif text-3xl sm:text-4xl font-semibold leading-tight max-w-2xl">
            Every TFAA, Texas ASA, and TSAA shoot, in one calendar.
          </h2>
          <p className="mt-3 text-muted-foreground max-w-2xl">
            We pull the latest schedules directly from each association so you
            can plan your next field, 3D, or indoor shoot without bouncing
            between tabs.
          </p>
        </section>

        {/* Source status / stats */}
        <div className="grid sm:grid-cols-3 gap-3 mb-6">
          {(isLoading
            ? ([null, null, null] as const)
            : (data?.sources ?? []).slice(0, 3)
          ).map((s, i) => (
            <SourceCard
              key={i}
              source={s}
              count={
                s?.name === "TFAA"
                  ? tfaaCount
                  : s?.name === "ASA"
                  ? asaCount
                  : s?.name === "TSAA"
                  ? tsaaCount
                  : 0
              }
              loading={isLoading}
            />
          ))}
        </div>

        {/* Filter + view toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-1.5 rounded-lg border border-card-border bg-card p-1">
            <FilterChip
              active={filter === "all"}
              onClick={() => setFilter("all")}
              testId="filter-all"
            >
              All ({(tfaaCount + asaCount + tsaaCount + clubCount) || 0})
            </FilterChip>
            <FilterChip
              active={filter === "TFAA"}
              onClick={() => setFilter("TFAA")}
              testId="filter-tfaa"
              source="TFAA"
            >
              TFAA ({tfaaCount})
            </FilterChip>
            <FilterChip
              active={filter === "ASA"}
              onClick={() => setFilter("ASA")}
              testId="filter-asa"
              source="ASA"
            >
              Texas ASA ({asaCount})
            </FilterChip>
            <FilterChip
              active={filter === "TSAA"}
              onClick={() => setFilter("TSAA")}
              testId="filter-tsaa"
              source="TSAA"
            >
              TSAA ({tsaaCount})
            </FilterChip>
            {clubCount > 0 && (
              <FilterChip
                active={filter === "CLUB"}
                onClick={() => setFilter("CLUB")}
                testId="filter-club"
                source="CLUB"
              >
                Club shoots ({clubCount})
              </FilterChip>
            )}
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-card-border bg-card p-1">
            <button
              onClick={() => setView("calendar")}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium hover-elevate ${
                view === "calendar"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              }`}
              data-testid="button-view-calendar"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Calendar
            </button>
            <button
              onClick={() => setView("list")}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium hover-elevate ${
                view === "list"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              }`}
              data-testid="button-view-list"
            >
              <List className="h-3.5 w-3.5" />
              List
            </button>
          </div>
        </div>

        {isError && (
          <div
            className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 mb-6 flex items-start gap-3"
            data-testid="state-error"
          >
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-destructive">
                Unable to load tournament schedule
              </p>
              <p className="text-muted-foreground mt-0.5">
                {error instanceof Error ? error.message : "Unknown error."}{" "}
                <button
                  className="underline underline-offset-2"
                  onClick={() => refresh.mutate()}
                >
                  Try again
                </button>
                .
              </p>
            </div>
          </div>
        )}

        {isLoading ? (
          <LoadingState />
        ) : view === "calendar" ? (
          <div className="grid 2xl:grid-cols-[1fr_320px] gap-6">
            <CalendarMonth events={filtered} initial={initial} />
            <aside>
              <h3 className="text-sm uppercase tracking-[0.18em] text-muted-foreground font-medium mb-3">
                Next up
              </h3>
              <UpcomingList events={upcoming.slice(0, 6)} />
            </aside>
          </div>
        ) : (
          <UpcomingList events={upcoming} />
        )}
      </main>

      <footer className="border-t border-border/70 bg-background/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 text-xs text-muted-foreground flex flex-wrap gap-3 items-center justify-between">
          <p>
            Schedule data is pulled live from{" "}
            <a
              className="underline underline-offset-2 hover:text-foreground"
              href="https://texasfieldarchery.org/schedule"
              target="_blank"
              rel="noreferrer noopener"
            >
              TFAA
            </a>{" "}
            ,{" "}
            <a
              className="underline underline-offset-2 hover:text-foreground"
              href="https://www.txasafederation.com/texas-asa-schedule"
              target="_blank"
              rel="noreferrer noopener"
            >
              Texas ASA
            </a>
            , and{" "}
            <a
              className="underline underline-offset-2 hover:text-foreground"
              href="https://texasarchery.org/Calendar"
              target="_blank"
              rel="noreferrer noopener"
            >
              TSAA
            </a>
            . Always confirm details with the host club.
          </p>
          <p>
            Hosting a shoot that isn't listed?{" "}
            <a
              className="underline underline-offset-2 hover:text-foreground"
              href={SUBMIT_SHOOT_HREF}
              data-testid="link-submit-shoot"
            >
              Submit a shoot
            </a>
          </p>
          {data && (
            <p>
              Last refreshed{" "}
              <span data-testid="text-footer-updated">
                {new Date(data.lastUpdated).toLocaleString()}
              </span>
            </p>
          )}
        </div>
      </footer>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
  testId,
  source,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  testId: string;
  source?: TournamentEvent["source"];
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium hover-elevate ${
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground"
      }`}
      data-testid={`button-${testId}`}
    >
      {source && (
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            sourceBarClass(source)
          }`}
        />
      )}
      {children}
    </button>
  );
}

function SourceCard({
  source,
  count,
  loading,
}: {
  source: { name: TournamentEvent["source"]; status: string; message: string | null; url: string; fetchedAt: string } | null;
  count: number;
  loading: boolean;
}) {
  if (loading || !source) {
    return (
      <div className="rounded-xl border border-card-border bg-card p-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-40 mt-2" />
      </div>
    );
  }
  const isOk = source.status === "ok";
  return (
    <div className="rounded-xl border border-card-border bg-card p-4" data-testid={`card-source-${source.name}`}>
      <div className="flex items-start gap-3">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase ${
            sourcePillClass(source.name)
          }`}
        >
          {sourceLabel(source.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {count} event{count === 1 ? "" : "s"} loaded
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
            {isOk ? (
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            ) : (
              <CircleAlert className="h-3 w-3 text-amber-600" />
            )}
            {isOk
              ? `Synced ${fmtRelative(source.fetchedAt)}`
              : source.message ?? "Source returned no events"}
          </p>
        </div>
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={`Visit ${source.name} schedule page`}
          className="text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid 2xl:grid-cols-[1fr_320px] gap-6">
      <div className="rounded-xl border border-card-border bg-card p-4 space-y-3">
        <Skeleton className="h-6 w-40" />
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
