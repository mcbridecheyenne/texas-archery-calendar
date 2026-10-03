// Tournaments added by archers (community_events in supabase/schema.sql),
// turned into the same shape the calendar uses, with source "USER".
import { db } from "../../lib/supabase";
import type { TournamentEvent } from "../calendar";

const FIELDS =
  "id, created_by, name, start_date, end_date, location, city, host, phone, email, url, details, status, created_at, " +
  "creator:profiles!community_events_created_by_fkey(display_name)";

export interface CommunityEventInput {
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  location: string;
  city: string;
  host: string;
  phone: string;
  email: string;
  url: string;
  details: string;
}

export const COMMUNITY_PREFIX = "user:";

export function isCommunityEvent(event: Pick<TournamentEvent, "id">): boolean {
  return event.id.startsWith(COMMUNITY_PREFIX);
}

export function communityId(event: Pick<TournamentEvent, "id">): string {
  return event.id.slice(COMMUNITY_PREFIX.length);
}

function toEvent(r: any): TournamentEvent {
  return {
    id: COMMUNITY_PREFIX + r.id,
    source: "USER",
    name: r.name,
    startDate: r.start_date,
    endDate: r.end_date,
    location: r.location,
    city: r.city,
    state: "TX",
    registrationStart: null,
    registrationEnd: null,
    contact: r.host,
    phone: r.phone,
    email: r.email,
    sourceUrl: r.url ?? "",
    addedBy: r.creator?.display_name ?? null,
    addedById: r.created_by,
    details: r.details,
  };
}

/** Active archer-added tournaments that haven't ended before `fromDate`. */
export async function fetchCommunityEvents(fromDate: string): Promise<TournamentEvent[]> {
  const { data, error } = await db()
    .from("community_events")
    .select(FIELDS)
    .eq("status", "active")
    .gte("end_date", fromDate)
    .order("start_date")
    .limit(500);
  if (error) throw error;
  return (data ?? []).map(toEvent);
}

export async function fetchCommunityEvent(id: string): Promise<TournamentEvent | null> {
  const { data, error } = await db().from("community_events").select(FIELDS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toEvent(data) : null;
}

function toRow(input: CommunityEventInput) {
  const clean = (s: string) => s.trim() || null;
  return {
    name: input.name.trim(),
    start_date: input.startDate,
    end_date: input.endDate,
    location: input.location.trim(),
    city: input.city.trim(),
    host: clean(input.host),
    phone: clean(input.phone),
    email: clean(input.email),
    url: clean(input.url),
    details: clean(input.details),
  };
}

export async function createCommunityEvent(me: string, input: CommunityEventInput): Promise<TournamentEvent> {
  const { data, error } = await db()
    .from("community_events")
    .insert({ ...toRow(input), created_by: me })
    .select(FIELDS)
    .single();
  if (error) throw error;
  return toEvent(data);
}

export async function updateCommunityEvent(id: string, input: CommunityEventInput): Promise<void> {
  const { error } = await db().from("community_events").update(toRow(input)).eq("id", id);
  if (error) throw error;
}

export async function deleteCommunityEvent(id: string): Promise<void> {
  const { error } = await db().from("community_events").delete().eq("id", id);
  if (error) throw error;
}
