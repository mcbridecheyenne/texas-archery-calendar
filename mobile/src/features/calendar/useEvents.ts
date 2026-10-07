import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { fetchEvents, readCachedEvents } from "./api";
import type { EventsResponse } from "./types";

export interface EventsState {
  data: EventsResponse | null;
  loading: boolean; // first load with nothing to show yet
  refreshing: boolean; // pull-to-refresh in progress
  error: string | null; // last load failed (data may still be the cached copy)
  refresh: () => Promise<void>;
}

const STALE_MS = 30 * 60 * 1000;

// Shows the saved schedule instantly, then loads the latest in the background.
export function useEvents(apiBaseUrl: string): EventsState {
  const [data, setData] = useState<EventsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastLoad = useRef(0);
  const mounted = useRef(true);

  const load = useCallback(
    async (force: boolean) => {
      try {
        const fresh = await fetchEvents(apiBaseUrl, force);
        lastLoad.current = Date.now();
        if (!mounted.current) return;
        setData(fresh);
        setError(null);
      } catch (e) {
        if (mounted.current) setError(e instanceof Error ? e.message : String(e));
      }
    },
    [apiBaseUrl]
  );

  useEffect(() => {
    mounted.current = true;
    (async () => {
      try {
        const cached = await readCachedEvents();
        if (cached && mounted.current) {
          setData(cached);
          setLoading(false);
        }
      } catch {
        // A bad saved copy: ignore it and load fresh.
      }
      try {
        await load(false);
      } finally {
        if (mounted.current) setLoading(false);
      }
    })();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  // Reload when the app comes back to the foreground after a while.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && Date.now() - lastLoad.current > STALE_MS) load(false);
    });
    return () => sub.remove();
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    if (mounted.current) setRefreshing(false);
  }, [load]);

  return { data, loading, refreshing, error, refresh };
}
