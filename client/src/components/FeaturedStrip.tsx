import { useEffect, useMemo, useState } from "react";
import type { TournamentEvent } from "@shared/schema";
import { fmtRange } from "@/lib/dates";
import { countSeen, fetchFeatured, type FeaturedShoot } from "@/lib/featured";
import { MapPin, Star } from "lucide-react";

// Up to 3 paid "Featured" shoots above the calendar, taking turns (the order changes daily),
// the same ones the app pins to the top of its Texas and All states lists.
const HIDE_KEY = "hideFeatured";

function readHidden(): boolean {
  try {
    return localStorage.getItem(HIDE_KEY) === "1";
  } catch {
    return false;
  }
}

export function FeaturedStrip({ events }: { events: TournamentEvent[] }) {
  const [featured, setFeatured] = useState<FeaturedShoot[]>([]);
  // Anyone can hide featured shoots, for free (remembered in this browser).
  const [hidden, setHidden] = useState(readHidden);
  const toggle = (hide: boolean) => {
    setHidden(hide);
    try {
      localStorage.setItem(HIDE_KEY, hide ? "1" : "0");
    } catch {}
  };

  useEffect(() => {
    let live = true;
    fetchFeatured(["TX", "ALL"])
      .then((list) => live && setFeatured(list))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const shown = useMemo(() => {
    const seen = new Set<string>();
    const unique = featured.filter((f) => !seen.has(f.eventId) && seen.add(f.eventId));
    const day = Math.floor(Date.now() / 86_400_000);
    const n = unique.length;
    return n ? unique.map((_, i) => unique[(i + day) % n]).slice(0, 3) : [];
  }, [featured]);

  const shownKey = hidden ? "" : shown.map((f) => f.id).join(",");
  useEffect(() => {
    if (shownKey) countSeen(shownKey.split(","));
  }, [shownKey]);

  if (!shown.length) return null;
  if (hidden) {
    return (
      <p className="mb-4 text-xs text-muted-foreground">
        Featured shoots are hidden.{" "}
        <button className="underline underline-offset-2 hover:text-foreground" onClick={() => toggle(false)}>
          Show them
        </button>
      </p>
    );
  }

  return (
    <section className="mb-6" data-testid="featured-shoots">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm uppercase tracking-[0.18em] text-muted-foreground font-medium">Featured</h3>
        <button
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          onClick={() => toggle(true)}
          data-testid="button-hide-featured"
        >
          Hide featured shoots
        </button>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((f) => {
          const official = events.find((e) => e.id === f.eventId);
          const link = official?.sourceUrl || "app.html";
          return (
            <li key={f.id} className="rounded-lg border border-card-border bg-card p-4" data-testid={`featured-${f.id}`}>
              <a href={link} target={official ? "_blank" : undefined} rel="noreferrer noopener" className="block">
                <div className="flex items-start gap-2">
                  <Star className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  <h4 className="text-base font-semibold leading-snug">{f.eventName}</h4>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{fmtRange(f.eventStart, f.eventEnd)}</p>
                {f.eventCity && (
                  <p className="mt-0.5 text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {f.eventCity}
                  </p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">Featured · promoted by {f.promoterName}</p>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
