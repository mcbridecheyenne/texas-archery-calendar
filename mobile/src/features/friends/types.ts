// Shapes for friends and shared "Going" (tables in supabase/schema.sql).

/** Who can see that you're going. "private" (Just me) is only ever seen by you: it's saved
 *  to your account (so a new phone gets it back) but no one else can read it. */
export type ShareLevel = "private" | "friends" | "public";

export interface Friend {
  id: string; // the other archer's profile id
  name: string;
  city: string | null;
  archeryClass: string | null;
  status: "pending" | "accepted";
  incoming: boolean; // true when they sent the request to you
  since: string;
}

export interface Attendee {
  userId: string;
  name: string;
  city: string | null;
  archeryClass: string | null;
  isFriend: boolean;
}

export type AddFriendResult = {
  status: "sent" | "accepted" | "already_sent" | "already_received" | "already_friends";
  name: string;
};

export function shareLabel(level: ShareLevel): string {
  if (level === "friends") return "Friends";
  if (level === "public") return "Everyone";
  return "Just me";
}
