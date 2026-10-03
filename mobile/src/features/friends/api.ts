// Supabase calls for friends and shared "Going". Row-level security in
// supabase/schema.sql decides what each archer can see; these just ask.
import { db } from "../../lib/supabase";
import type { TournamentEvent } from "../calendar";
import type { AddFriendResult, Attendee, Friend } from "./types";

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

export async function fetchMyFriendCode(me: string): Promise<string | null> {
  const { data, error } = await db().from("profiles").select("friend_code").eq("id", me).maybeSingle();
  if (error) throw error;
  return (data as { friend_code: string | null } | null)?.friend_code ?? null;
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

/** Your own shared events: event id → who can see it. */
export async function fetchMyShares(me: string): Promise<Map<string, "friends" | "public">> {
  const { data, error } = await db().from("going").select("event_id, visibility").eq("user_id", me);
  if (error) throw error;
  return new Map(((data ?? []) as { event_id: string; visibility: "friends" | "public" }[]).map((r) => [r.event_id, r.visibility]));
}

export async function shareGoing(me: string, event: TournamentEvent, visibility: "friends" | "public"): Promise<void> {
  const { error } = await db().from("going").upsert({
    user_id: me,
    event_id: event.id,
    event_name: event.name.slice(0, 200),
    event_date: event.startDate,
    visibility,
  });
  if (error) throw error;
}

export async function unshareGoing(me: string, eventId: string): Promise<void> {
  const { error } = await db().from("going").delete().eq("user_id", me).eq("event_id", eventId);
  if (error) throw error;
}

/** Upcoming events your friends shared: event id → friend ids. */
export async function fetchFriendsGoing(friendIds: string[], fromDate: string): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (!friendIds.length) return map;
  const { data, error } = await db()
    .from("going")
    .select("user_id, event_id")
    .in("user_id", friendIds)
    .gte("event_date", fromDate)
    .limit(2000);
  if (error) throw error;
  for (const r of (data ?? []) as { user_id: string; event_id: string }[]) {
    const arr = map.get(r.event_id);
    if (arr) arr.push(r.user_id);
    else map.set(r.event_id, [r.user_id]);
  }
  return map;
}

/** Everyone you're allowed to see going to one event (not including you). */
export async function fetchAttendees(me: string, eventId: string, friendIds: Set<string>): Promise<Attendee[]> {
  const { data, error } = await db()
    .from("going")
    .select("user_id, profile:profiles!going_user_id_fkey(display_name, city, archery_class)")
    .eq("event_id", eventId)
    .neq("user_id", me)
    .order("created_at", { ascending: true })
    .limit(300);
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => ({
    userId: r.user_id,
    name: r.profile?.display_name ?? "Archer",
    city: r.profile?.city ?? null,
    archeryClass: r.profile?.archery_class ?? null,
    isFriend: friendIds.has(r.user_id),
  }));
}

export interface SearchResult {
  id: string;
  name: string;
  city: string | null;
  archeryClass: string | null;
  relation: "none" | "sent" | "received" | "friends";
}

/** Archers who chose to be findable, whose name (or town) matches. */
export async function searchArchers(q: string): Promise<SearchResult[]> {
  const { data, error } = await db().rpc("search_archers", { q });
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
