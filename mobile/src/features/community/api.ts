// Tournaments added by archers (community_events in supabase/schema.sql),
// turned into the same shape the calendar uses, with source "USER".
import * as ImageManipulator from "expo-image-manipulator";
import { decode } from "base64-arraybuffer";
import { db, PHOTO_BUCKET, photoUrl } from "../../lib/supabase";
import type { TournamentEvent } from "../calendar";

const COLUMNS =
  "id, created_by, name, start_date, end_date, location, city, state, flyer_path, host, phone, email, url, details, status, created_at";
const FIELDS = `${COLUMNS}, creator:profiles!community_events_created_by_fkey(display_name)`;

// Signed-out visitors can't read profiles, so they get the tournaments without who added them.
async function fields(): Promise<string> {
  const { data } = await db().auth.getSession();
  return data.session ? FIELDS : COLUMNS;
}

export interface CommunityEventInput {
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  location: string;
  city: string;
  state: string; // two letters, e.g. "TX"
  host: string;
  phone: string;
  email: string;
  url: string;
  details: string;
  /** Keep the current flyer ({ path }), a newly picked one ({ uri, width, height }), or none (null). */
  flyer: { path?: string; uri?: string; width?: number; height?: number } | null;
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
    state: r.state ?? "TX",
    registrationStart: null,
    registrationEnd: null,
    contact: r.host,
    phone: r.phone,
    email: r.email,
    sourceUrl: r.url ?? "",
    addedBy: r.creator?.display_name ?? null,
    addedById: r.created_by,
    details: r.details,
    flyerPath: r.flyer_path ?? null,
    flyerUrl: r.flyer_path ? photoUrl(r.flyer_path) : null,
  };
}

// Flyers keep more detail than listing photos so the fine print stays readable.
async function uploadFlyer(me: string, flyer: NonNullable<CommunityEventInput["flyer"]>): Promise<string> {
  if (flyer.path) return flyer.path;
  const ctx = ImageManipulator.ImageManipulator.manipulate(flyer.uri!);
  const w = flyer.width ?? 0;
  const h = flyer.height ?? 0;
  if (w > 2000 || h > 2000) ctx.resize(w >= h ? { width: 2000 } : { height: 2000 });
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ compress: 0.75, format: ImageManipulator.SaveFormat.JPEG, base64: true });
  const path = `${me}/tournaments/${Date.now()}.jpg`;
  const { error } = await db().storage.from(PHOTO_BUCKET).upload(path, decode(saved.base64!), { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  return path;
}

async function removeFlyer(path: string | null | undefined) {
  if (path) await db().storage.from(PHOTO_BUCKET).remove([path]).catch(() => {});
}

/** Active archer-added tournaments that haven't ended before `fromDate`. */
export async function fetchCommunityEvents(fromDate: string): Promise<TournamentEvent[]> {
  const { data, error } = await db()
    .from("community_events")
    .select(await fields())
    .eq("status", "active")
    .gte("end_date", fromDate)
    .order("start_date")
    .limit(500);
  if (error) throw error;
  return (data ?? []).map(toEvent);
}

export async function fetchCommunityEvent(id: string): Promise<TournamentEvent | null> {
  const { data, error } = await db().from("community_events").select(await fields()).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toEvent(data) : null;
}

function toRow(input: CommunityEventInput, flyerPath: string | null) {
  const clean = (s: string) => s.trim() || null;
  return {
    name: input.name.trim(),
    start_date: input.startDate,
    end_date: input.endDate,
    location: input.location.trim(),
    city: input.city.trim(),
    state: (input.state.trim() || "TX").toUpperCase(),
    host: clean(input.host),
    phone: clean(input.phone),
    email: clean(input.email),
    url: clean(input.url),
    details: clean(input.details),
    flyer_path: flyerPath,
  };
}

export async function createCommunityEvent(me: string, input: CommunityEventInput): Promise<TournamentEvent> {
  const flyerPath = input.flyer ? await uploadFlyer(me, input.flyer) : null;
  const { data, error } = await db()
    .from("community_events")
    .insert({ ...toRow(input, flyerPath), created_by: me })
    .select(FIELDS)
    .single();
  if (error) {
    await removeFlyer(flyerPath);
    throw error;
  }
  return toEvent(data);
}

/** `previousFlyer` is the stored flyer before editing, so a replaced or removed one gets cleaned up. */
export async function updateCommunityEvent(me: string, id: string, input: CommunityEventInput, previousFlyer?: string | null): Promise<void> {
  const flyerPath = input.flyer ? await uploadFlyer(me, input.flyer) : null;
  const { error } = await db().from("community_events").update(toRow(input, flyerPath)).eq("id", id);
  if (error) {
    if (flyerPath !== previousFlyer) await removeFlyer(flyerPath);
    throw error;
  }
  if (previousFlyer && previousFlyer !== flyerPath) await removeFlyer(previousFlyer);
}

export async function deleteCommunityEvent(id: string, flyerPath?: string | null): Promise<void> {
  const { error } = await db().from("community_events").delete().eq("id", id);
  if (error) throw error;
  await removeFlyer(flyerPath);
}
