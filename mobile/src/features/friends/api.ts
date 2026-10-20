// Supabase calls for friends and shared "Going". Row-level security in
// supabase/schema.sql decides what each archer can see; these just ask.
import { db } from "../../lib/supabase";
import type { TournamentEvent } from "../calendar";
import type { AddFriendResult, Attendee, Friend, ShareLevel } from "./types";

const FRIENDSHIP_FIELDS =
  "requester_id, addressee_id, status, created_at, " +
  "requester:profiles!friendships_requester_id_fkey(id, display_name, city, archery_class), " +
  "addressee:profiles!friendships_addressee_id_fkey(id, display_name, city, archery_class)";

type ProfileBit = { id: string; display_name: string; city: string | null; archery_class: string | null } | null;

export async function fetchFriendships(me: string): Promise<Friend[]> {
  const { data, error } = await db().from("friendships").select(FRIENDSHIP_FIELDS).order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => {
    const incoming = r.addressee_id === me;
    const other = (incoming ? r.requester : r.addressee) as ProfileBit;
    return {
      id: incoming ? r.requester_id : r.addressee_id,
      name: other?.display_name ?? "Archer",
      city: other?.city ?? null,
      archeryClass: other?.archery_class ?? null,
      status: r.status,
      incoming,
      since: r.created_at,
    } as Friend;
  });
}

// Friend codes are private, so your own comes from a database function.
export async function fetchMyFriendCode(): Promise<string | null> {
  const { data, error } = await db().rpc("my_friend_code");
  if (error) throw error;
  return (data as string | null) ?? null;
}

export async function sendFriendRequest(code: string): Promise<AddFriendResult> {
  const { data, error } = await db().rpc("send_friend_request", { code });
  if (error) throw error;
  return data as AddFriendResult;
}

export async function acceptFriend(me: string, other: string): Promise<void> {
  const { error } = await db()
    .from("friendships")
    .update({ status: "accepted" })
    .eq("requester_id", other)
    .eq("addressee_id", me);
  if (error) throw error;
}

/** Declines a request, cancels one you sent, or unfriends. */
export async function removeFriend(me: string, other: string): Promise<void> {
  const { error } = await db()
    .from("friendships")
    .delete()
    .or(`and(requester_id.eq.${me},addressee_id.eq.${other}),and(requester_id.eq.${other},addressee_id.eq.${me})`);
  if (error) throw error;
}

/** One of your own rows in the "going" table: a starred shoot saved to your account. */
export interface MyGoingRow {
  eventId: string;
  eventName: string;
  eventDate: string;
  visibility: ShareLevel;
  /** The days they picked on a shoot of more than one day; null means every day. */
  days?: string[] | null;
  /** True when they picked "Maybe" rather than "Going". */
  maybe?: boolean;
}

// The "days" column (which days of a multi-day shoot) and the "status" column (Going or
// Maybe) come from newer versions of schema.sql. Until that's run in Supabase, the database
// turns down anything that mentions them, so we ask again without the missing one and stop
// sending it until the app is opened again. Nothing else changes (a Maybe is saved as Going).
let daysColumn = true;
let statusColumn = true;
function missingColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error || !(error.code === "PGRST204" || error.code === "42703")) return false;
  const msg = error.message ?? "";
  if (daysColumn && /\bdays\b/.test(msg)) {
    daysColumn = false;
    return true;
  }
  if (statusColumn && /\bstatus\b/.test(msg)) {
    statusColumn = false;
    return true;
  }
  return false;
}
const extraFields = () => `${daysColumn ? ", days" : ""}${statusColumn ? ", status" : ""}`;

/** Every shoot you starred that's saved to your account, including "Just me" ones. */
export async function fetchMyGoing(me: string): Promise<MyGoingRow[]> {
  const ask = () =>
    db()
      .from("going")
      .select(`event_id, event_name, event_date, visibility${extraFields()}`)
      .eq("user_id", me)
      .limit(2000);
  let { data, error } = await ask();
  while (missingColumn(error)) ({ data, error } = await ask());
  if (error) throw error;
  return ((data ?? []) as unknown as { event_id: string; event_name: string; event_date: string; visibility: ShareLevel; days?: string[] | null; status?: string | null }[]).map((r) => ({
    eventId: r.event_id,
    eventName: r.event_name,
    eventDate: r.event_date,
    visibility: r.visibility,
    days: r.days ?? null,
    maybe: r.status === "maybe",
  }));
}

/** A shoot to save, with the days they picked (undefined or empty = every day). */
type ShootBits = Pick<TournamentEvent, "id" | "name" | "startDate"> & { days?: string[] | null; maybe?: boolean };

const goingRow = (me: string, shoot: ShootBits, visibility: ShareLevel) => ({
  user_id: me,
  event_id: shoot.id,
  event_name: shoot.name.slice(0, 200),
  event_date: shoot.startDate,
  visibility,
  ...(daysColumn ? { days: shoot.days?.length ? shoot.days.slice(0, 31) : null } : {}),
  ...(statusColumn ? { status: shoot.maybe ? "maybe" : "going" } : {}),
});

/** Saves a starred shoot to your account with who can see it ("private" = Just me, only you). */
export async function shareGoing(me: string, shoot: ShootBits, visibility: ShareLevel): Promise<void> {
  const ask = () => db().from("going").upsert(goingRow(me, shoot, visibility));
  let { error } = await ask();
  while (missingColumn(error)) ({ error } = await ask());
  if (error) throw error;
}

/** Saves several starred shoots as "Just me", leaving any that are already saved as they are. */
export async function saveGoingPrivately(me: string, shoots: ShootBits[]): Promise<void> {
  if (!shoots.length) return;
  const ask = () =>
    db()
      .from("going")
      .upsert(shoots.map((s) => goingRow(me, s, "private")), { onConflict: "user_id,event_id", ignoreDuplicates: true });
  let { error } = await ask();
  while (missingColumn(error)) ({ error } = await ask());
  if (error) throw error;
}

/** Changes which days of a saved shoot you're going (empty or undefined = every day). */
export async function setGoingDays(me: string, eventId: string, days: string[] | undefined): Promise<void> {
  if (!daysColumn) return;
  const { error } = await db()
    .from("going")
    .update({ days: days?.length ? days.slice(0, 31) : null })
    .eq("user_id", me)
    .eq("event_id", eventId);
  if (missingColumn(error)) return;
  if (error) throw error;
}

/** Switches a saved shoot between "Going" and "Maybe". */
export async function setGoingMaybe(me: string, eventId: string, maybe: boolean): Promise<void> {
  if (!statusColumn) return;
  const { error } = await db()
    .from("going")
    .update({ status: maybe ? "maybe" : "going" })
    .eq("user_id", me)
    .eq("event_id", eventId);
  if (missingColumn(error)) return;
  if (error) throw error;
}

export async function unshareGoing(me: string, eventId: string): Promise<void> {
  const { error } = await db().from("going").delete().eq("user_id", me).eq("event_id", eventId);
  if (error) throw error;
}

/** A friend who shared a shoot, and whether they said "Maybe". */
export interface FriendGoing {
  userId: string;
  maybe: boolean;
}

/** Upcoming events your friends shared: event id → those friends. */
export async function fetchFriendsGoing(friendIds: string[], fromDate: string): Promise<Map<string, FriendGoing[]>> {
  const map = new Map<string, FriendGoing[]>();
  if (!friendIds.length) return map;
  const ask = () =>
    db()
      .from("going")
      .select(`user_id, event_id${statusColumn ? ", status" : ""}`)
      .in("user_id", friendIds)
      .neq("visibility", "private") // "Just me" rows are hidden by the database anyway; this is a second lock
      .gte("event_date", fromDate)
      .limit(2000);
  let { data, error } = await ask();
  while (missingColumn(error)) ({ data, error } = await ask());
  if (error) throw error;
  for (const r of (data ?? []) as unknown as { user_id: string; event_id: string; status?: string | null }[]) {
    const who = { userId: r.user_id, maybe: r.status === "maybe" };
    const arr = map.get(r.event_id);
    if (arr) arr.push(who);
    else map.set(r.event_id, [who]);
  }
  return map;
}

/** Everyone you're allowed to see going to one event (not including you). */
export async function fetchAttendees(me: string, eventId: string, friendIds: Set<string>): Promise<Attendee[]> {
  const ask = () =>
    db()
      .from("going")
      .select(`user_id${extraFields()}, profile:profiles!going_user_id_fkey(display_name, city, archery_class)`)
      .eq("event_id", eventId)
      .neq("user_id", me)
      .neq("visibility", "private")
      .order("created_at", { ascending: true })
      .limit(300);
  let { data, error } = await ask();
  while (missingColumn(error)) ({ data, error } = await ask());
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => ({
    userId: r.user_id,
    name: r.profile?.display_name ?? "Archer",
    city: r.profile?.city ?? null,
    archeryClass: r.profile?.archery_class ?? null,
    isFriend: friendIds.has(r.user_id),
    days: Array.isArray(r.days) && r.days.length ? (r.days as string[]) : null,
    maybe: r.status === "maybe",
  }));
}

export interface SearchResult {
  id: string;
  name: string;
  city: string | null;
  archeryClass: string | null;
  relation: "none" | "sent" | "received" | "friends";
}

/** Archers who chose to be findable, whose name (or town) matches, optionally only one class. */
export async function searchArchers(q: string, archeryClass?: string | null): Promise<SearchResult[]> {
  const { data, error } = await db().rpc("search_archers", { q, klass: archeryClass || null });
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    name: r.display_name,
    city: r.city ?? null,
    archeryClass: r.archery_class ?? null,
    relation: r.relation,
  }));
}

export async function sendFriendRequestTo(target: string): Promise<AddFriendResult> {
  const { data, error } = await db().rpc("send_friend_request_to", { target });
  if (error) throw error;
  return data as AddFriendResult;
}
