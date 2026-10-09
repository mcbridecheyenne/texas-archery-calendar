// Grants a featured spot after an in-app purchase.
//
// The app buys one of the feature_* consumables through RevenueCat, then calls this with the
// store transaction id and the shoot. We ask RevenueCat (secret API key) whether that
// transaction really exists for that customer, then create the featured_shoots row with the
// service role. A tampered phone can't give itself a feature: nothing here trusts the app's
// word about the purchase, and only this function can write the table.
//
// Secrets (Supabase Dashboard -> Edge Functions -> Secrets):
//   REVENUECAT_SECRET_KEY  the "secret" API key from app.revenuecat.com -> Project -> API keys
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are set by Supabase itself.
import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS, PRODUCTS, dayAfter, json, nextStart } from "../_shared/featured.ts";

interface Body {
  rcAppUserId: string;
  transactionId: string;
  productId: string;
  placement: "state" | "national";
  state?: string | null;
  buyerName: string;
  event: {
    id: string;
    source: string;
    name: string;
    startDate: string;
    endDate: string;
    city?: string | null;
    state?: string | null;
    location?: string | null;
    url?: string | null;
    flyerPath?: string | null;
  };
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const clip = (s: unknown, max: number) => (typeof s === "string" && s.trim() ? s.trim().slice(0, max) : null);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const rcKey = Deno.env.get("REVENUECAT_SECRET_KEY");
  if (!rcKey) return json({ error: "Featured shoots aren't switched on yet." }, 503);

  const url = Deno.env.get("SUPABASE_URL")!;
  const auth = req.headers.get("Authorization") ?? "";
  // Who is asking: the signed-in archer (their own token), and they must be an active member.
  const token = auth.replace(/^Bearer\s+/i, "");
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: userData } = token ? await asUser.auth.getUser(token) : { data: null };
  const user = userData?.user;
  if (!user) return json({ error: "Sign in to feature a shoot." }, 401);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: profile } = await admin.from("profiles").select("display_name, is_banned").eq("id", user.id).maybeSingle();
  if (!profile || profile.is_banned) return json({ error: "This account can't feature shoots." }, 403);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad request." }, 400);
  }

  const product = PRODUCTS[body.productId];
  if (!product) return json({ error: "Unknown product." }, 400);
  const state = product.placement === "state" ? (body.state ?? "").toUpperCase() : null;
  if (product.placement === "state" && !/^[A-Z]{2}$/.test(state ?? "")) return json({ error: "Pick a state." }, 400);
  const transactionId = clip(body.transactionId, 120);
  const rcAppUserId = clip(body.rcAppUserId, 200);
  if (!transactionId || !rcAppUserId) return json({ error: "Missing purchase details." }, 400);

  const ev = body.event ?? ({} as Body["event"]);
  const eventId = clip(ev.id, 120);
  const name = clip(ev.name, 160);
  if (!eventId || !name || !ISO_DAY.test(ev.startDate ?? "") || !ISO_DAY.test(ev.endDate ?? "")) return json({ error: "Missing shoot details." }, 400);
  const today = new Date().toISOString().slice(0, 10);
  if (ev.endDate < today) return json({ error: "That shoot is already over." }, 400);
  const buyerName = clip(body.buyerName, 60) ?? profile.display_name;

  // Archer-added shoots must exist and be active; the snapshot comes from the database, not the phone.
  if (eventId.startsWith("user:")) {
    const { data: row } = await admin
      .from("community_events")
      .select("name, start_date, end_date, city, state, location, url, flyer_path, status")
      .eq("id", eventId.slice(5))
      .maybeSingle();
    if (!row || row.status !== "active") return json({ error: "That tournament isn't on the calendar any more." }, 400);
    ev.name = row.name;
    ev.startDate = row.start_date;
    ev.endDate = row.end_date;
    ev.city = row.city;
    ev.state = row.state;
    ev.location = row.location;
    ev.url = row.url;
    ev.flyerPath = row.flyer_path;
    ev.source = "USER";
  }

  // The same transaction can't buy two features.
  const { data: used } = await admin.from("featured_shoots").select("id").eq("store_transaction_id", transactionId).maybeSingle();
  if (used) return json({ error: "That purchase was already used.", id: used.id }, 409);

  // Ask RevenueCat whether this customer really made this purchase.
  const rc = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(rcAppUserId)}`, {
    headers: { Authorization: `Bearer ${rcKey}`, Accept: "application/json" },
  });
  if (!rc.ok) return json({ error: `Couldn't check the purchase (${rc.status}). Try again in a moment.` }, 502);
  const sub = (await rc.json())?.subscriber;
  const purchases: any[] = sub?.non_subscriptions?.[body.productId] ?? [];
  const match = purchases.find((p) => p.store_transaction_id === transactionId || p.id === transactionId);
  if (!match) return json({ error: "RevenueCat doesn't show that purchase yet. Try again in a minute." }, 402);
  const purchasedAt = new Date(match.purchase_date);
  if (Date.now() - purchasedAt.getTime() > 48 * 3600 * 1000) return json({ error: "That purchase is too old to use." }, 402);

  // Where it goes in the queue for this spot.
  const spot = product.placement === "national" ? "ALL" : state!;
  const { data: others } = await admin.from("featured_shoots").select("ends_at").eq("spot", spot).eq("status", "active").gt("ends_at", new Date().toISOString());
  const startsAt = nextStart((others ?? []).map((o: { ends_at: string }) => o.ends_at));
  const paidUntil = new Date(startsAt.getTime() + product.days * 86400 * 1000);
  const shootOver = dayAfter(ev.endDate);
  const endsAt = paidUntil < shootOver ? paidUntil : shootOver;
  if (endsAt <= startsAt) {
    return json({ error: "That spot is full until after the shoot. Ask Apple for a refund of this purchase and pick another spot." }, 409);
  }

  const { data: inserted, error } = await admin
    .from("featured_shoots")
    .insert({
      buyer_id: user.id,
      buyer_name: buyerName,
      event_id: eventId,
      event_source: clip(ev.source, 20) ?? "OTHER",
      event_name: clip(ev.name, 160),
      event_start: ev.startDate,
      event_end: ev.endDate,
      event_city: clip(ev.city, 80),
      event_state: clip(ev.state, 2)?.toUpperCase() ?? null,
      event_location: clip(ev.location, 200),
      event_url: clip(ev.url, 400),
      event_flyer_path: clip(ev.flyerPath, 200),
      placement: product.placement,
      state,
      days: product.days,
      product_id: body.productId,
      store: clip(match.store, 20),
      store_transaction_id: transactionId,
      rc_app_user_id: rcAppUserId,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
    })
    .select("id, starts_at, ends_at")
    .single();
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, ...inserted });
});
