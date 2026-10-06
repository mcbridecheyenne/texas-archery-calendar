// Friends, friend requests and shared "Going" for the signed-in archer, shared by the
// Tournaments tab, the Friends screen and the Account tab badge.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { useAuth } from "../../lib/auth";
import { onStarsMoved, type TournamentEvent } from "../calendar";
import * as api from "./api";
import { syncMyShoots } from "./myShoots";
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
  /** Removes an un-starred shoot from the account. */
  removeGoing: (eventId: string) => Promise<void>;
  addByCode: (code: string) => Promise<AddFriendResult>;
  addById: (archerId: string) => Promise<AddFriendResult>;
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
  removeGoing: noop,
  addByCode: async () => {
    throw new Error("Sign in to add friends.");
  },
  addById: async () => {
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
  // Every starred shoot saved to the account → who can see it ("private" = Just me).
  const [shares, setShares] = useState<Map<string, ShareLevel>>(new Map());
  const [goingIds, setGoingIds] = useState<Map<string, string[]>>(new Map());

  // Who's signed in right now, so a slow answer for someone who just signed out is ignored.
  const signedInAs = useRef<string | null>(null);
  signedInAs.current = active ? userId : null;

  // Account changes to My Shoots wait their turn here, one at a time, so a sync and a
  // tap on the star never trip over each other.
  const turn = useRef<Promise<unknown>>(Promise.resolve());
  const inTurn = useCallback(<T,>(job: () => Promise<T>): Promise<T> => {
    const next = turn.current.then(job);
    turn.current = next.catch(() => {});
    return next;
  }, []);

  // Brings the account's copy of My Shoots and this phone's in step (see myShoots.ts).
  const syncGoing = useCallback((): Promise<void> => {
    if (!active || !userId) return Promise.resolve();
    const me = userId;
    return inTurn(async () => {
      if (signedInAs.current !== me) return;
      const rows = await syncMyShoots(me);
      if (signedInAs.current === me) setShares(new Map(rows.map((r) => [r.eventId, r.visibility])));
    });
  }, [active, userId, inTurn]);

  const refresh = useCallback(async () => {
    if (!active || !userId) return;
    try {
      const [list, code] = await Promise.all([
        api.fetchFriendships(userId),
        api.fetchMyFriendCode(userId),
        syncGoing().catch(() => {}),
      ]);
      setAll(list);
      setFriendCode(code);
      const ids = list.filter((f) => f.status === "accepted").map((f) => f.id);
      setGoingIds(await api.fetchFriendsGoing(ids, weekAgoIso()));
    } catch {
      // Keep what we have; the next app open retries.
    }
  }, [active, userId, syncGoing]);

  // A starred shoot moved to a new id (new date or place): move the account's copy too.
  useEffect(() => {
    if (!active) return;
    return onStarsMoved(() => {
      syncGoing().catch(() => {});
    });
  }, [active, syncGoing]);

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

  // Changes one shoot's entry in the list above (null removes it).
  const setShareEntry = useCallback((eventId: string, level: ShareLevel | null) => {
    setShares((cur) => {
      const next = new Map(cur);
      if (level) next.set(eventId, level);
      else next.delete(eventId);
      return next;
    });
  }, []);

  const setShareLevel = useCallback(
    async (event: TournamentEvent, level: ShareLevel) => {
      if (!active || !userId) return;
      const me = userId;
      const before = shares.get(event.id) ?? null;
      setShareEntry(event.id, level);
      await inTurn(async () => {
        try {
          if (level !== "private") {
            await api.shareGoing(me, event, level);
          } else {
            // "Just me": keep it in the account where only they can read it. If the database
            // hasn't been updated for that yet, fall back to the old way (remove it there).
            try {
              await api.shareGoing(me, event, "private");
            } catch {
              await api.unshareGoing(me, event.id);
            }
          }
          if (signedInAs.current === me) setShareEntry(event.id, level);
        } catch (e) {
          if (signedInAs.current === me) setShareEntry(event.id, before);
          throw e;
        }
      });
    },
    [active, userId, shares, setShareEntry, inTurn]
  );

  const removeGoing = useCallback(
    async (eventId: string) => {
      if (!active || !userId) return;
      const me = userId;
      setShareEntry(eventId, null);
      await inTurn(async () => {
        await api.unshareGoing(me, eventId);
        if (signedInAs.current === me) setShareEntry(eventId, null);
      });
    },
    [active, userId, setShareEntry, inTurn]
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

  const addById = useCallback(
    async (archerId: string) => {
      if (!active) throw new Error("Sign in and finish your profile to add friends.");
      const result = await api.sendFriendRequestTo(archerId);
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
      removeGoing,
      addByCode,
      addById,
      accept,
      remove,
      refresh,
    }),
    [active, friendCode, friends, incoming, outgoing, friendIds, friendsGoing, shareLevelFor, setShareLevel, removeGoing, addByCode, addById, accept, remove, refresh]
  );

  return <FriendsContext.Provider value={value}>{children}</FriendsContext.Provider>;
}
