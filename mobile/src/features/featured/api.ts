// Featured shoots in Supabase (featured_shoots in supabase/schema.sql). Anyone can read the
// ones running now; rows are only created by the claim-feature edge function after it checks
// the Apple purchase, so this file never writes them directly.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { db } from "../../lib/supabase";
import type { FeaturedPin } from "../calendar";

export interface MyFeature {
  id: string;
  spot: string;
  eventId: string;
  days: number;
  startsAt: string;
  endsAt: string;
  views: number;
  opens: number;
}

/** Every feature running now, all spots (at most 3 per state plus 3 nationwide). */
export async function fetchFeatured(): Promise<FeaturedPin[]> {
  const { data, error } = await db()
    .from("featured_shoots")
    .select("id, spot, event_id, event_name, event_start, promoter_name, starts_at, ends_at, status")
    .eq("status", "active")
    .lte("starts_at", new Date().toISOString())
    .gt("ends_at", new Date().toISOString());
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    spot: r.spot,
    eventId: r.event_id,
    eventName: r.event_name,
    eventStart: r.event_start,
    promoterName: r.promoter_name,
  }));
}

/** The signed-in archer's features for one shoot (running, waiting, or finished), newest first. */
export async function fetchMyFeatures(me: string, eventId: string, eventName: string): Promise<MyFeature[]> {
  const { data, error } = await db()
    .from("featured_shoots")
    .select("id, spot, event_id, event_name, days, starts_at, ends_at, views, opens")
    .eq("promoter_id", me)
    .or(`event_id.eq.${JSON.stringify(eventId)},event_name.eq.${JSON.stringify(eventName)}`)
    .order("starts_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    spot: r.spot,
    eventId: r.event_id,
    days: r.days,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    views: r.views,
    opens: r.opens,
  }));
}

/** How many run in a spot now, and when a new one would start. */
export async function fetchAvailability(spot: string): Promise<{ running: number; nextStart: Date }> {
  const { data, error } = await db().rpc("featured_availability", { want_spot: spot });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as { running: number; next_start: string } | undefined;
  return { running: row?.running ?? 0, nextStart: row?.next_start ? new Date(row.next_start) : new Date() };
}

// View and open counts. Each feature is counted once per app launch.
const seenThisLaunch = new Set<string>();
export function countSeen(ids: string[]) {
  const fresh = ids.filter((id) => !seenThisLaunch.has(id));
  if (!fresh.length) return;
  fresh.forEach((id) => seenThisLaunch.add(id));
  db().rpc("featured_seen", { ids: fresh }).then(() => {}, () => {});
}
export function countOpened(id: string) {
  db().rpc("featured_opened", { feature: id }).then(() => {}, () => {});
}

// ---- Claiming a purchase ----
// The claim is saved on the phone before it's sent, so if the connection drops right after
// paying, the app sends it again on the next launch (the function ignores repeats).

export interface Claim {
  productId: string;
  transactionId: string;
  appUserId: string;
  eventId: string;
  spot: string;
}

export type ClaimResult = { ok: true; startsAt: string; endsAt: string } | { ok: false; message: string; retry: boolean };

const PENDING_KEY = "featured.pendingClaims.v1";

async function readPending(): Promise<Claim[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
async function writePending(list: Claim[]) {
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(list)).catch(() => {});
}

async function send(claim: Claim): Promise<ClaimResult> {
  const { data, error } = await db().functions.invoke("claim-feature", { body: claim });
  if (!error && data?.ok) return { ok: true, startsAt: data.feature.starts_at, endsAt: data.feature.ends_at };
  let status = 0;
  let message = "Couldn't reach the server.";
  const res = (error as any)?.context;
  if (res && typeof res.json === "function") {
    status = res.status ?? 0;
    const body = await res.json().catch(() => null);
    if (body?.message) message = body.message;
  } else if (data?.message) {
    message = data.message;
  }
  // Worth trying again later: no connection, purchase not visible yet, or a server hiccup.
  const retry = status === 0 || status === 402 || status >= 500;
  return { ok: false, message, retry };
}

export async function claimFeature(claim: Claim): Promise<ClaimResult> {
  const pending = await readPending();
  await writePending([...pending.filter((c) => c.transactionId !== claim.transactionId), claim]);
  const result = await send(claim);
  if (result.ok || !result.retry) {
    await writePending((await readPending()).filter((c) => c.transactionId !== claim.transactionId));
  }
  return result;
}

/** Sends any claims that didn't go through (call when signed in). Returns how many succeeded. */
export async function retryPendingClaims(): Promise<number> {
  const pending = await readPending();
  let done = 0;
  for (const claim of pending) {
    const result = await send(claim);
    if (result.ok) done++;
    if (result.ok || !result.retry) {
      await writePending((await readPending()).filter((c) => c.transactionId !== claim.transactionId));
    }
  }
  return done;
}
