// Archer-added tournaments, shared by the Tournaments tab and the add/edit screens.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { useAuth } from "../../lib/auth";
import { readCachedEvents, type TournamentEvent } from "../calendar";
import { fetchCommunityEvents } from "./api";

export interface CommunityState {
  enabled: boolean;
  events: TournamentEvent[];
  refresh: () => Promise<void>;
  /** Official (last downloaded) plus archer-added events, for duplicate checks. */
  everything: () => Promise<TournamentEvent[]>;
}

const CommunityContext = createContext<CommunityState>({
  enabled: false,
  events: [],
  refresh: async () => {},
  everything: async () => [],
});

export function useCommunity(): CommunityState {
  return useContext(CommunityContext);
}

function weekAgoIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function CommunityProvider({ children }: { children: ReactNode }) {
  const { enabled, blocked, userId } = useAuth();
  const [raw, setRaw] = useState<TournamentEvent[]>([]);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      setRaw(await fetchCommunityEvents(weekAgoIso()));
    } catch {
      // Keep the last list; pull to refresh retries.
    }
    // userId: signing in or out changes what can be read (who added each one), so reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, userId]);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  // Hide tournaments from people you've blocked.
  const events = useMemo(() => raw.filter((e) => !e.addedById || !blocked.has(e.addedById)), [raw, blocked]);

  const everything = useCallback(async () => {
    const official = (await readCachedEvents())?.events ?? [];
    return [...official, ...events];
  }, [events]);

  const value = useMemo(() => ({ enabled, events, refresh, everything }), [enabled, events, refresh, everything]);
  return <CommunityContext.Provider value={value}>{children}</CommunityContext.Provider>;
}
