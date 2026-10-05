// The signed-in person's conversations, kept live, shared by the Messages tab and its badge.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { useAuth } from "../../lib/auth";
import { fetchConversations, subscribeToInbox } from "./api";
import { isUnread, type Conversation } from "./types";

interface InboxState {
  conversations: Conversation[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
}

const InboxContext = createContext<InboxState>({
  conversations: [],
  unreadCount: 0,
  loading: false,
  refresh: async () => {},
});

export function useInbox(): InboxState {
  return useContext(InboxContext);
}

export function InboxProvider({ children }: { children: ReactNode }) {
  const { userId, profile, blocked } = useAuth();
  const [all, setAll] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const active = !!userId && !!profile;

  const refresh = useCallback(async () => {
    if (!active) return;
    try {
      setAll(await fetchConversations());
    } catch {
      // Keep what we have; the next change or app open will retry.
    }
  }, [active]);

  useEffect(() => {
    if (!active) {
      setAll([]);
      return;
    }
    setLoading(true);
    refresh().finally(() => setLoading(false));
    const unsubscribe = subscribeToInbox(refresh);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") refresh();
    });
    return () => {
      unsubscribe();
      sub.remove();
    };
  }, [active, refresh]);

  const value = useMemo<InboxState>(() => {
    const conversations = all.filter((c) => !blocked.has(c.buyer_id === userId ? c.seller_id : c.buyer_id));
    return {
      conversations,
      unreadCount: userId ? conversations.filter((c) => isUnread(c, userId)).length : 0,
      loading,
      refresh,
    };
  }, [all, blocked, userId, loading, refresh]);

  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
}
