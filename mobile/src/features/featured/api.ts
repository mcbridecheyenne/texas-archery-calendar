import AsyncStorage from "@react-native-async-storage/async-storage";
import { db, marketplaceConfigured } from "../../lib/supabase";
import type { TournamentEvent } from "../calendar";
import type { FeatureProduct, PurchaseReceipt } from "../../monetization/premium";
import type { FeaturedShoot } from "./types";

const COLUMNS =
  "id, buyer_id, buyer_name, event_id, event_source, event_name, event_start, event_end, event_city, event_state, event_location, event_url, event_flyer_path, placement, state, spot, days, starts_at, ends_at, status, shown_count, opened_count";

function toFeatured(r: any): FeaturedShoot {
  return {
    id: r.id,
    buyerId: r.buyer_id,
    buyerName: r.buyer_name,
    eventId: r.event_id,
    eventSource: r.event_source,
    eventName: r.event_name,
    eventStart: r.event_start,
    eventEnd: r.event_end,
    eventCity: r.event_city,
    eventState: r.event_state,
    eventLocation: r.event_location,
    eventUrl: r.event_url,
    eventFlyerPath: r.event_flyer_path,
    placement: r.placement,
    state: r.state,
    spot: r.spot,
    days: r.days,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    status: r.status,
    shownCount: r.shown_count ?? 0,
    openedCount: r.opened_count ?? 0,
  };
}

/** Every live or queued feature (all spots), soonest-ending first. Works signed out. */
export async function fetchFeatured(): Promise<FeaturedShoot[]> {
  if (!marketplaceConfigured) return [];
  const { data, error } = await db()
    .from("featured_shoots")
    .select(COLUMNS)
    .eq("status", "active")
    .gt("ends_at", new Date().toISOString())
    .order("ends_at")
    .limit(500);
  if (error) throw error;
  return (data ?? []).map(toFeatured);
}

/** The signed-in archer's own features, newest first, including ended ones. */
export async function fetchMyFeatured(me: string): Promise<FeaturedShoot[]> {
  const { data, error } = await db().from("featured_shoots").select(COLUMNS).eq("buyer_id", me).order("created_at", { ascending: false }).limit(50);
  if (error) throw error;
  return (data ?? []).map(toFeatured);
}

/** "Shown N times · M opened" counters. Best effort; never blocks the list. */
export function countFeatured(ids: string[], kind: "shown" | "opened"): void {
  if (!marketplaceConfigured || !ids.length) return;
  db()
    .rpc("count_featured", { ids: ids.slice(0, 20), kind })
    .then(() => {}, () => {});
}

export interface GrantInput {
  product: FeatureProduct;
  receipt: PurchaseReceipt;
  state: string | null; // for a state placement
  buyerName: string;
  event: TournamentEvent;
}

/** After the purchase: asks the feature-shoot function to check it with RevenueCat and create the feature. */
export async function grantFeature(input: GrantInput): Promise<{ id: string; startsAt: string; endsAt: string }> {
  const { data, error } = await db().functions.invoke("feature-shoot", {
    body: {
      rcAppUserId: input.receipt.appUserId,
      transactionId: input.receipt.transactionId,
      productId: input.product.id,
      placement: input.product.placement,
      state: input.state,
      buyerName: input.buyerName,
      event: {
        id: input.event.id,
        source: input.event.source,
        name: input.event.name,
        startDate: input.event.startDate,
        endDate: input.event.endDate,
        city: input.event.city,
        state: input.event.state,
        location: input.event.location,
        url: input.event.sourceUrl || null,
        flyerPath: input.event.flyerPath ?? null,
      },
    },
  });
  if (error) {
    // The function's own message ("Sign in to feature a shoot.") beats the generic HTTP error.
    const body = await (error as any)?.context?.json?.().catch(() => null);
    throw new Error(body?.error ?? error.message);
  }
  if (!data?.ok) throw new Error(data?.error ?? "Couldn't create the feature.");
  return { id: data.id, startsAt: data.starts_at, endsAt: data.ends_at };
}

// A purchase that went through before the feature could be created (no signal, say) is kept on
// the phone and finished at the next launch, so nobody pays twice.
const PENDING_KEY = "featured.pending";

export async function savePending(input: GrantInput): Promise<void> {
  const { product, ...rest } = input;
  const slim = { ...rest, product: { id: product.id, placement: product.placement, days: product.days, price: product.price, product: null } };
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(slim)).catch(() => {});
}

export async function clearPending(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_KEY).catch(() => {});
}

/** Finishes a saved purchase, if there is one. True when a feature was created. */
export async function finishPending(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(PENDING_KEY).catch(() => null);
  if (!raw) return false;
  try {
    const input = JSON.parse(raw) as GrantInput;
    await grantFeature(input);
    await clearPending();
    return true;
  } catch (e: any) {
    // "Already used" means an earlier try did succeed; anything else is retried next launch.
    if (/already used/i.test(e?.message ?? "")) await clearPending();
    return false;
  }
}
