// Paid "Featured" shoots at the top of the list: the same cards the app shows, read straight
// from Supabase (public rows only; the database rules decide what is visible). The website
// shows the Texas schedule, so it takes the Texas spot and the nationwide ("All states") spot.
// Each card says "Featured · promoted by <name>", so paid placement never looks like an
// association's own ranking. Bought in the app (mobile/docs/featured-shoots.md).
import { useQuery } from "@tanstack/react-query";
import { Star, MapPin, ExternalLink } from "lucide-react";
import { fmtRange, parseISODate } from "@/lib/dates";

// The project's public URL and "anon" key: safe to ship, like in the app (mobile/config.ts).
const SUPABASE_URL = "https://mefqiniuudxcnoimfipo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_GWYdb3dSEHy4jvrkkJJEww_FD6nOt3B";
const SPOTS = ["TX", "ALL"];
const PER_SPOT = 3;

interface FeaturedRow {
  id: string;
  buyer_name: string;
  event_name: string;
  event_start: string;
  event_end: string;
  event_city: string | null;
  event_state: string | null;
  event_location: string | null;
  event_url: string | null;
  event_flyer_path: string | null;
  spot: string;
  starts_at: string;
  ends_at: string;
}

async function loadFeatured(): Promise<FeaturedRow[]> {
  const now = new Date().toISOString();
  const params = new URLSearchParams({
    select: "id,buyer_name,event_name,event_start,event_end,event_city,event_state,event_location,event_url,event_flyer_path,spot,starts_at,ends_at",
    status: "eq.active",
    starts_at: `lte.${now}`,
    ends_at: `gt.${now}`,
    spot: `in.(${SPOTS.join(",")})`,
    order: "ends_at",
  });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/featured_shoots?${params}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Featured shoots: ${res.status}`);
  return (await res.json()) as FeaturedRow[];
}

// A fixed shuffle per page load, so the three in a spot take turns at the top.
const seed = Math.random();
function rank(id: string): number {
  let h = 0;
  const s = id + seed;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export function FeaturedShoots({ compact = false }: { compact?: boolean }) {
  const { data } = useQuery<FeaturedRow[]>({
    queryKey: ["featured_shoots"],
    queryFn: loadFeatured,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  if (!data?.length) return null;

  const today = new Date().toISOString().slice(0, 10);
  const cards: FeaturedRow[] = [];
  for (const spot of SPOTS) {
    const inSpot = data.filter((f) => f.spot === spot && f.event_end >= today).sort((a, b) => rank(a.id) - rank(b.id)).slice(0, PER_SPOT);
    for (const f of inSpot) if (!cards.some((c) => c.event_name === f.event_name && c.event_start === f.event_start)) cards.push(f);
  }
  if (!cards.length) return null;

  return (
    <section className={compact ? "mb-6" : "mb-8"} data-testid="list-featured">
      <h3 className="text-sm uppercase tracking-[0.18em] text-muted-foreground font-medium mb-3 inline-flex items-center gap-1.5">
        <Star className="h-3.5 w-3.5" /> Featured
      </h3>
      <ul className="space-y-2">
        {cards.map((f) => {
          const d = parseISODate(f.event_start);
          const place = f.event_location ?? [f.event_city, f.event_state].filter(Boolean).join(", ");
          const flyer = f.event_flyer_path ? `${SUPABASE_URL}/storage/v1/object/public/listing-photos/${f.event_flyer_path}` : null;
          const body = (
            <>
              <div className="flex flex-col items-center justify-center w-14 shrink-0 rounded-md border border-card-border bg-background py-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{d.toLocaleString("en-US", { month: "short" })}</span>
                <span className="font-serif text-xl leading-none mt-0.5">{d.getDate()}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold tracking-wide text-primary">★ Featured · promoted by {f.buyer_name}</p>
                <h4 className="text-base font-semibold leading-snug">{f.event_name}</h4>
                <p className="mt-1 text-sm text-muted-foreground">{fmtRange(f.event_start, f.event_end)}</p>
                {place && (
                  <p className="mt-0.5 text-sm text-muted-foreground inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{place}</span>
                  </p>
                )}
              </div>
              {flyer && <img src={flyer} alt="" className="hidden sm:block w-14 h-[72px] rounded-md object-cover shrink-0" loading="lazy" />}
              {f.event_url && <ExternalLink className="hidden sm:block h-3.5 w-3.5 text-muted-foreground self-center" />}
            </>
          );
          const cls = "group flex items-start gap-4 rounded-lg border-2 border-primary/60 bg-card p-4 hover-elevate";
          return (
            <li key={f.id} data-testid={`row-featured-${f.id}`}>
              {f.event_url ? (
                <a href={f.event_url} target="_blank" rel="noreferrer noopener" className={cls} aria-label={`${f.event_name}, featured, promoted by ${f.buyer_name}`}>
                  {body}
                </a>
              ) : (
                <div className={cls}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
