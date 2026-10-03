// Everything the marketplace reads and writes in Supabase.
import { decode } from "base64-arraybuffer";
import * as ImageManipulator from "expo-image-manipulator";
import { db, PHOTO_BUCKET } from "../../lib/supabase";
import type { Category, Condition, Conversation, Listing, Message, ReportReason } from "./types";

const LISTING_FIELDS =
  "id, seller_id, title, description, price_cents, category, condition, city, handoff_event_id, handoff_event_name, handoff_event_date, photos, status, created_at, updated_at, seller:profiles(id, display_name, city, created_at)";

export const PAGE_SIZE = 24;

export interface ListingQuery {
  search?: string;
  category?: Category | null;
  eventIds?: string[] | null; // only listings handed off at these shoots
  page?: number;
}

export async function fetchListings(q: ListingQuery): Promise<Listing[]> {
  const page = q.page ?? 0;
  let req = db()
    .from("listings")
    .select(LISTING_FIELDS)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  if (q.category) req = req.eq("category", q.category);
  if (q.eventIds) req = req.in("handoff_event_id", q.eventIds.length ? q.eventIds : ["none"]);
  const term = (q.search ?? "").replace(/[%_,()*\\]/g, " ").trim();
  if (term) req = req.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
  const { data, error } = await req;
  if (error) throw error;
  return (data ?? []) as unknown as Listing[];
}

export async function fetchListing(id: string): Promise<Listing | null> {
  const { data, error } = await db().from("listings").select(LISTING_FIELDS).eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as unknown as Listing) ?? null;
}

export async function fetchMyListings(userId: string): Promise<Listing[]> {
  const { data, error } = await db()
    .from("listings")
    .select(LISTING_FIELDS)
    .eq("seller_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Listing[];
}

// ---------- Creating and editing ----------

export interface PhotoItem {
  // Either an already-uploaded photo (path) or a new one picked on the phone (uri).
  path?: string;
  uri?: string;
  width?: number;
  height?: number;
}

export interface ListingInput {
  title: string;
  description: string;
  priceCents: number;
  category: Category;
  condition: Condition;
  city: string;
  handoff: { id: string; name: string; date: string } | null;
  photos: PhotoItem[];
}

function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// Shrinks photos to at most 1280px and ~200–400 KB before upload, to keep storage free-tier friendly.
async function uploadPhoto(userId: string, listingId: string, photo: PhotoItem, index: number): Promise<string> {
  const ctx = ImageManipulator.ImageManipulator.manipulate(photo.uri!);
  const w = photo.width ?? 0;
  const h = photo.height ?? 0;
  if (w > 1280 || h > 1280) ctx.resize(w >= h ? { width: 1280 } : { height: 1280 });
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true });
  const path = `${userId}/${listingId}/${Date.now()}-${index}.jpg`;
  const { error } = await db().storage.from(PHOTO_BUCKET).upload(path, decode(saved.base64!), {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function saveListing(userId: string, input: ListingInput, existing?: Listing): Promise<string> {
  const listingId = existing?.id ?? uuid();

  const paths: string[] = [];
  for (let i = 0; i < input.photos.length; i++) {
    const p = input.photos[i];
    paths.push(p.path ?? (await uploadPhoto(userId, listingId, p, i)));
  }

  const row = {
    title: input.title.trim(),
    description: input.description.trim(),
    price_cents: input.priceCents,
    category: input.category,
    condition: input.condition,
    city: input.city.trim() || null,
    handoff_event_id: input.handoff?.id ?? null,
    handoff_event_name: input.handoff?.name ?? null,
    handoff_event_date: input.handoff?.date ?? null,
    photos: paths,
  };

  if (existing) {
    const { error } = await db().from("listings").update(row).eq("id", listingId);
    if (error) throw error;
    const dropped = existing.photos.filter((p) => !paths.includes(p));
    if (dropped.length) await db().storage.from(PHOTO_BUCKET).remove(dropped);
  } else {
    const { error } = await db().from("listings").insert({ id: listingId, seller_id: userId, ...row });
    if (error) {
      if (paths.length) await db().storage.from(PHOTO_BUCKET).remove(paths);
      throw error;
    }
  }
  return listingId;
}

export async function setListingStatus(id: string, status: "active" | "sold"): Promise<void> {
  const { error } = await db().from("listings").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function deleteListing(listing: Listing): Promise<void> {
  const { error } = await db().from("listings").delete().eq("id", listing.id);
  if (error) throw error;
  if (listing.photos.length) await db().storage.from(PHOTO_BUCKET).remove(listing.photos);
}

// ---------- Reports ----------

export async function report(input: {
  reporterId: string;
  reason: ReportReason;
  listingId?: string;
  userId?: string;
  messageId?: number;
  communityEventId?: string;
  details?: string;
}): Promise<void> {
  const { error } = await db().from("reports").insert({
    reporter_id: input.reporterId,
    reason: input.reason,
    listing_id: input.listingId ?? null,
    reported_user_id: input.userId ?? null,
    message_id: input.messageId ?? null,
    community_event_id: input.communityEventId ?? null,
    details: input.details ?? null,
  });
  if (error) throw error;
}

// ---------- Conversations and messages ----------

const CONVERSATION_FIELDS =
  "id, listing_id, listing_title, buyer_id, seller_id, created_at, last_message_at, last_message_preview, last_sender_id, buyer_read_at, seller_read_at, buyer:profiles!conversations_buyer_id_fkey(id, display_name), seller:profiles!conversations_seller_id_fkey(id, display_name)";

export async function fetchConversations(): Promise<Conversation[]> {
  const { data, error } = await db()
    .from("conversations")
    .select(CONVERSATION_FIELDS)
    .not("last_message_at", "is", null)
    .order("last_message_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as unknown as Conversation[];
}

export async function fetchConversation(id: string): Promise<Conversation | null> {
  const { data, error } = await db().from("conversations").select(CONVERSATION_FIELDS).eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as unknown as Conversation) ?? null;
}

// Finds the buyer's existing chat about this listing, or starts one.
export async function openConversation(listing: Listing, buyerId: string): Promise<string> {
  const { data: found } = await db()
    .from("conversations")
    .select("id")
    .eq("listing_id", listing.id)
    .eq("buyer_id", buyerId)
    .maybeSingle();
  if (found) return (found as { id: string }).id;
  const { data, error } = await db()
    .from("conversations")
    .insert({ listing_id: listing.id, listing_title: listing.title, buyer_id: buyerId, seller_id: listing.seller_id })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await db()
    .from("messages")
    .select("id, conversation_id, sender_id, body, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as Message[];
}

export async function sendMessage(conversationId: string, senderId: string, body: string): Promise<Message> {
  const { data, error } = await db()
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: senderId, body: body.trim() })
    .select("id, conversation_id, sender_id, body, created_at")
    .single();
  if (error) throw error;
  return data as Message;
}

export async function markRead(c: Conversation, me: string): Promise<void> {
  const field = me === c.buyer_id ? "buyer_read_at" : "seller_read_at";
  await db().from("conversations").update({ [field]: new Date().toISOString() }).eq("id", c.id);
}

// Calls back on every new message in one conversation.
export function subscribeToMessages(conversationId: string, onMessage: (m: Message) => void): () => void {
  const channel = db()
    .channel(`messages:${conversationId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
      (payload) => onMessage(payload.new as Message)
    )
    .subscribe();
  return () => {
    db().removeChannel(channel);
  };
}

// Calls back whenever any of the person's conversations changes (new message, read).
export function subscribeToInbox(onChange: () => void): () => void {
  const channel = db()
    .channel("inbox")
    .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => onChange())
    .subscribe();
  return () => {
    db().removeChannel(channel);
  };
}
