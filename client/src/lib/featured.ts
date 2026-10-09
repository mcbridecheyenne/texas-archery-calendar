// Paid "Featured" shoots, read straight from the app's Supabase database (the same rows the
// app shows at the top of its lists). Anyone can read the ones running now; the key below is
// the public client key the app also ships with.
const SUPABASE_URL = "https://mefqiniuudxcnoimfipo.supabase.co";
const SUPABASE_KEY = "sb_publishable_GWYdb3dSEHy4jvrkkJJEww_FD6nOt3B";

export interface FeaturedShoot {
  id: string;
  spot: string; // two-letter state, or "ALL"
  eventId: string;
  eventName: string;
  eventStart: string;
  eventEnd: string;
  eventCity: string | null;
  promoterName: string;
}

/** Features running now in these spots (this site shows the Texas schedule: TX and ALL). */
export async function fetchFeatured(spots: string[]): Promise<FeaturedShoot[]> {
  const now = new Date().toISOString();
  const params = new URLSearchParams({
    select: "id,spot,event_id,event_name,event_start,event_end,event_city,promoter_name",
    status: "eq.active",
    starts_at: `lte.${now}`,
    ends_at: `gt.${now}`,
    spot: `in.(${spots.join(",")})`,
    order: "starts_at.asc",
  });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/featured_shoots?${params}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) return [];
  const rows = (await res.json()) as any[];
  return rows.map((r) => ({
    id: r.id,
    spot: r.spot,
    eventId: r.event_id,
    eventName: r.event_name,
    eventStart: r.event_start,
    eventEnd: r.event_end,
    eventCity: r.event_city,
    promoterName: r.promoter_name,
  }));
}

/** Counts the views the promoter sees in the app. */
export function countSeen(ids: string[]) {
  if (!ids.length) return;
  fetch(`${SUPABASE_URL}/rest/v1/rpc/featured_seen`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  }).catch(() => {});
}
