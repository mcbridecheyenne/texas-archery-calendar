// claim-feature: the app calls this right after an Apple purchase of a "Featured" spot.
// It checks the purchase really happened (with RevenueCat), that the shoot is upcoming and
// that the spot has room, then creates the featured_shoots row. The app can't create those
// rows itself, so a tampered phone can't give itself a free feature.
//
// Secrets (Supabase → Edge Functions → Secrets): REVENUECAT_SECRET_KEY, the RevenueCat
// secret API key (v1, starts with "sk_"). SUPABASE_URL, SUPABASE_ANON_KEY and
// SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import { createClient } from "npm:@supabase/supabase-js@2";
import { featureWindow, findPurchase, parseClaim, PRODUCTS, type ShootFacts, type StorePurchase } from "./logic.ts";

const FEEDS = [
  "https://mcbridecheyenne.github.io/texas-archery-calendar/events-usa.json",
  "https://mcbridecheyenne.github.io/texas-archery-calendar/events.json",
];
const COMMUNITY_PREFIX = "user:";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const fail = (status: number, message: string) => json(status, { ok: false, message });

async function findShoot(admin: ReturnType<typeof createClient>, eventId: string): Promise<ShootFacts | null> {
  if (eventId.startsWith(COMMUNITY_PREFIX)) {
    const { data } = await admin
      .from("community_events")
      .select("id, name, start_date, end_date, city, status")
      .eq("id", eventId.slice(COMMUNITY_PREFIX.length))
      .maybeSingle();
    if (!data || data.status !== "active") return null;
    return { id: eventId, name: data.name, startDate: data.start_date, endDate: data.end_date, source: "USER", city: data.city };
  }
  for (const url of FEEDS) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) continue;
      const feed = (await res.json()) as { events?: Array<Record<string, unknown>> };
      const e = feed.events?.find((x) => x.id === eventId);
      if (e) {
        return {
          id: eventId,
          name: String(e.name ?? "").slice(0, 200),
          startDate: String(e.startDate),
          endDate: String(e.endDate ?? e.startDate),
          source: String(e.source ?? "OTHER"),
          city: typeof e.city === "string" ? e.city.slice(0, 80) : null,
        };
      }
    } catch {
      // try the next feed
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return fail(405, "Use POST.");

  const url = Deno.env.get("SUPABASE_URL")!;
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: who } = await asUser.auth.getUser(token);
  const userId = who?.user?.id;
  if (!userId) return fail(401, "Sign in first.");

  const claim = parseClaim(await req.json().catch(() => null));
  if (typeof claim === "string") return fail(400, claim);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Already claimed (the app retries after a lost connection): return it.
  const { data: existing } = await admin.from("featured_shoots").select("*").eq("purchase_id", claim.transactionId).maybeSingle();
  if (existing) {
    return existing.promoter_id === userId ? json(200, { ok: true, feature: existing }) : fail(409, "That purchase was already used.");
  }

  const { data: member } = await admin.from("profiles").select("display_name, is_banned").eq("id", userId).maybeSingle();
  if (!member || member.is_banned) return fail(403, "Finish your profile first.");

  // Check the purchase with RevenueCat.
  const rcKey = Deno.env.get("REVENUECAT_SECRET_KEY");
  if (!rcKey) return fail(503, "Featured shoots aren't set up yet.");
  const rc = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(claim.appUserId)}`, {
    headers: { Authorization: `Bearer ${rcKey}` },
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  if (!rc?.ok) return fail(502, "Couldn't check the purchase. Try again in a minute.");
  const subscriber = (await rc.json())?.subscriber as { non_subscriptions?: Record<string, StorePurchase[]> } | undefined;
  const purchase = findPurchase(subscriber?.non_subscriptions?.[claim.productId], claim.transactionId);
  if (!purchase) return fail(402, "We couldn't find that purchase yet. Try again in a minute.");

  const shoot = await findShoot(admin, claim.eventId);
  if (!shoot) return fail(404, "That shoot isn't on the schedule anymore.");

  const { data: next, error: nextError } = await admin.rpc("featured_next_start", { want_spot: claim.spot });
  if (nextError) return fail(500, "Couldn't check open places. Try again.");
  const window = featureWindow(shoot, PRODUCTS[claim.productId].days, new Date(next as string), new Date());
  if (typeof window === "string") return fail(409, `${window} Apple can refund it: reportaproblem.apple.com.`);

  const { data: feature, error } = await admin
    .from("featured_shoots")
    .insert({
      spot: claim.spot,
      event_id: shoot.id,
      event_name: shoot.name,
      event_start: shoot.startDate,
      event_end: shoot.endDate,
      event_source: shoot.source,
      event_city: shoot.city,
      promoter_id: userId,
      promoter_name: member.display_name,
      product_id: claim.productId,
      purchase_id: claim.transactionId,
      days: PRODUCTS[claim.productId].days,
      starts_at: window.startsAt.toISOString(),
      ends_at: window.endsAt.toISOString(),
    })
    .select("*")
    .single();
  if (error) return fail(500, "Couldn't save the feature. Try again.");
  return json(200, { ok: true, feature });
});
