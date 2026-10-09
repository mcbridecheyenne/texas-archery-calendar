// The features running now, refreshed when the app comes back to the screen. Also sends any
// purchase claims that didn't go through earlier.
import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { useAuth } from "../../lib/auth";
import type { FeaturedPin } from "../calendar";
import { fetchFeatured, retryPendingClaims } from "./api";

export function useFeatured(): { featured: FeaturedPin[]; refresh: () => Promise<void> } {
  const { enabled, userId } = useAuth();
  const [featured, setFeatured] = useState<FeaturedPin[]>([]);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      setFeatured(await fetchFeatured());
    } catch {
      // keep the last list
    }
  }, [enabled]);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener("change", (s) => s === "active" && refresh());
    return () => sub.remove();
  }, [refresh]);

  useEffect(() => {
    if (!userId) return;
    retryPendingClaims().then((n) => {
      if (n > 0) refresh();
    }, () => {});
  }, [userId, refresh]);

  return { featured, refresh };
}
