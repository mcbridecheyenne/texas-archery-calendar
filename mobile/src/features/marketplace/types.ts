// Shapes of the marketplace tables in supabase/schema.sql.

export type Category =
  | "bows" | "arrows" | "sights" | "rests" | "releases" | "stabilizers"
  | "cases" | "targets" | "points" | "apparel" | "other";

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: "bows", label: "Bows" },
  { id: "arrows", label: "Arrows & shafts" },
  { id: "sights", label: "Sights & scopes" },
  { id: "rests", label: "Rests" },
  { id: "releases", label: "Releases" },
  { id: "stabilizers", label: "Stabilizers" },
  { id: "cases", label: "Cases & quivers" },
  { id: "targets", label: "Targets" },
  { id: "points", label: "Points & broadheads" },
  { id: "apparel", label: "Apparel & boots" },
  { id: "other", label: "Other" },
];

export type Condition = "new" | "like_new" | "good" | "fair" | "parts";

export const CONDITIONS: { id: Condition; label: string }[] = [
  { id: "new", label: "New" },
  { id: "like_new", label: "Like new" },
  { id: "good", label: "Good" },
  { id: "fair", label: "Fair" },
  { id: "parts", label: "For parts" },
];

export function categoryLabel(id: Category): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? "Other";
}

export function conditionLabel(id: Condition): string {
  return CONDITIONS.find((c) => c.id === id)?.label ?? id;
}

export interface Profile {
  id: string;
  display_name: string;
  city: string | null;
  archery_class?: string | null;
  discoverable?: boolean; // shows up when other archers search by name
  created_at: string;
}

export interface Listing {
  id: string;
  seller_id: string;
  title: string;
  description: string;
  price_cents: number;
  category: Category;
  condition: Condition;
  city: string | null;
  handoff_event_id: string | null;
  handoff_event_name: string | null;
  handoff_event_date: string | null; // YYYY-MM-DD
  photos: string[];
  status: "active" | "sold" | "removed";
  created_at: string;
  updated_at: string;
  seller?: Pick<Profile, "id" | "display_name" | "city" | "created_at"> | null;
}

export interface Conversation {
  id: string;
  listing_id: string | null;
  listing_title: string;
  buyer_id: string;
  seller_id: string;
  created_at: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_sender_id: string | null;
  buyer_read_at: string | null;
  seller_read_at: string | null;
  buyer?: Pick<Profile, "id" | "display_name"> | null;
  seller?: Pick<Profile, "id" | "display_name"> | null;
}

export interface Message {
  id: number;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export type ReportReason = "scam" | "prohibited" | "offensive" | "spam" | "other";

export function formatPrice(cents: number): string {
  if (cents === 0) return "Free";
  const dollars = cents / 100;
  return `$${dollars.toLocaleString("en-US", {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function isUnread(c: Conversation, me: string): boolean {
  if (!c.last_message_at || c.last_sender_id === me) return false;
  const readAt = me === c.buyer_id ? c.buyer_read_at : c.seller_read_at;
  return !readAt || readAt < c.last_message_at;
}
