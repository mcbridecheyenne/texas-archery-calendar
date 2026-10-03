// Friends, friend requests and shared "Going" for the signed-in archer, shared by the
// Tournaments tab, the Friends screen and the Account tab badge.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { useAuth } from "../../lib/auth";
import type { TournamentEvent } from "../calendar";
import * as api from "./api";
import type { AddFriendResult, Friend, ShareLevel } from "./types";

export interface FriendsState {
  /** Signed in with a profile, and the marketplace backend is set up. */
  active: boolean;
  friendCode: string | null;
  friends: Friend[]; // accepted
  incoming: Friend[]; // requests waiting for you
  outgoing: Friend[]; // requests you sent
  friendIds: Set<string>;
  /** event id → names of friends who shared that they're going */
  friendsGoing: Map<string, string[]>;
  shareLevelFor: (eventId: string) => ShareLevel;
  setShareLevel: (event: TournamentEvent, level: ShareLevel) => Promise<void>;
  addByCode: (code: string) => Promise<AddFriendResult>;
  accept: (friendId: string) => Promise<void>;
  remove: (friendId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const noop = async () => {};
const FriendsContext = createContext<FriendsState>({
  active: false,
  friendCode: null,
  friends: [],
  incoming: [],
  outgoing: [],
  friendIds: new Set(),
  friendsGoing: new Map(),
  shareLevelFor: () => "private",
  setShareLevel: noop,
  addByCode: async () => {
    throw new Error("Sign in to add friends.");
  },
  accept: noop,
  remove: noop,
  refresh: noop,
});

export function useFriends(): FriendsState {
  return useContext(FriendsContext);
}

function weekAgoIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function FriendsProvider({ children }: { children: ReactNode }) {
  const { enabled, userId, profile, blocked } = useAuth();
  const active = enabled && !!userId && !!profile;
  const [all, setAll] = useState<Friend[]>([]);
  const [friendCode, setFriendCode] = useState<string | null>(null);
  const [shares, setShares] = useState<Map<string, "friends" | "public">>(new Map());
  const [goingIds, setGoingIds] = useState<Map<string, string[]>>(new Map());

  const refresh = useCallback(async () => {
    if (!active || !userId) return;
    try {
      const [list, code, mine] = await Promise.all([
        api.fetchFriendships(userId),
        api.fetchMyFriendCode(userId),
        api.fetchMyShares(userId),
      ]);
      setAll(list);
      setFriendCode(code);
      setShares(mine);
      const ids = list.filter((f) => f.status === "accepted").map((f) => f.id);
      setGoingIds(await api.fetchFriendsGoing(ids, weekAgoIso()));
    } catch {
      // Keep what we have; the next app open retries.
    }
  }, [active, userId]);

  useEffect(() => {
    if (!active) {
      setAll([]);
      setFriendCode(null);
      setShares(new Map());
      setGoingIds(new Map());
      return;
    }
    refresh();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") refresh();
    });
    return () => sub.remove();
  }, [active, refresh]);

  const visible = useMemo(() => all.filter((f) => !blocked.has(f.id)), [all, blocked]);
  const friends = useMemo(() => visible.filter((f) => f.status === "accepted"), [visible]);
  const incoming = useMemo(() => visible.filter((f) => f.status === "pending" && f.incoming), [visible]);
  const outgoing = useMemo(() => visible.filter((f) => f.status === "pending" && !f.incoming), [visible]);
  const friendIds = useMemo(() => new Set(friends.map((f) => f.id)), [friends]);

  const friendsGoing = useMemo(() => {
    const names = new Map(friends.map((f) => [f.id, f.name]));
    const out = new Map<string, string[]>();
    for (const [eventId, ids] of goingIds) {
      const list = ids.map((id) => names.get(id)).filter((n): n is string => !!n);
      if (list.length) out.set(eventId, list);
    }
    return out;
  }, [goingIds, friends]);

  const shareLevelFor = useCallback((eventId: string): ShareLevel => shares.get(eventId) ?? "private", [shares]);

  const setShareLevel = useCallback(
    async (event: TournamentEvent, level: ShareLevel) => {
      if (!active || !userId) return;
      const before = shares;
      const next = new Map(shares);
      if (level === "private") next.delete(event.id);
      else next.set(event.id, level);
      setShares(next);
      try {
        if (level === "private") await api.unshareGoing(userId, event.id);
        else await api.shareGoing(userId, event, level);
      } catch (e) {
        setShares(before);
        throw e;
      }
    },
    [active, userId, shares]
  );

  const addByCode = useCallback(
    async (code: string) => {
      if (!active) throw new Error("Sign in and finish your profile to add friends.");
      const result = await api.sendFriendRequest(code);
      await refresh();
      return result;
    },
    [active, refresh]
  );

  const accept = useCallback(
    async (friendId: string) => {
      if (!userId) return;
      await api.acceptFriend(userId, friendId);
      await refresh();
    },
    [userId, refresh]
  );

  const remove = useCallback(
    async (friendId: string) => {
      if (!userId) return;
      await api.removeFriend(userId, friendId);
      setAll((cur) => cur.filter((f) => f.id !== friendId));
      await refresh();
    },
    [userId, refresh]
  );

  const value = useMemo<FriendsState>(
    () => ({
      active,
      friendCode,
      friends,
      incoming,
      outgoing,
      friendIds,
      friendsGoing,
      shareLevelFor,
      setShareLevel,
      addByCode,
      accept,
      remove,
      refresh,
    }),
    [active, friendCode, friends, incoming, outgoing, friendIds, friendsGoing, shareLevelFor, setShareLevel, addByCode, accept, remove, refresh]
  );

  return <FriendsContext.Provider value={value}>{children}</FriendsContext.Provider>;
}
