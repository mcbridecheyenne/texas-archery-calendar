// One shared Supabase client. Sessions are saved on the phone so people stay signed in.
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AppState } from "react-native";
import { SUPABASE } from "../../config";

export const marketplaceConfigured = !!SUPABASE.url && !!SUPABASE.anonKey;

export const supabase: SupabaseClient | null = marketplaceConfigured
  ? createClient(SUPABASE.url, SUPABASE.anonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

// Only refresh the sign-in token while the app is on screen (Supabase's recommended setup for phones).
if (supabase) {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export function db(): SupabaseClient {
  if (!supabase) throw new Error("The marketplace isn't set up yet.");
  return supabase;
}

export const PHOTO_BUCKET = "listing-photos";

export function photoUrl(path: string): string {
  return db().storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}
