// Sign-in state for the whole app: the Supabase session, the person's public
// profile, and who they've blocked. Browsing never needs an account; posting
// and messaging do.
import * as AppleAuthentication from "expo-apple-authentication";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import type { Session } from "@supabase/supabase-js";
import type { Profile } from "../features/marketplace/types";
import { forgetPushToken } from "./push";
import { PHOTO_BUCKET, supabase } from "./supabase";

export interface AuthState {
  enabled: boolean; // marketplace configured
  loading: boolean;
  session: Session | null;
  userId: string | null;
  profile: Profile | null; // null until they finish setup
  suggestedName: string | null; // from Sign in with Apple, to prefill setup
  blocked: Set<string>;
  appleAvailable: boolean;
  signInWithApple: () => Promise<"ok" | "cancelled">;
  sendEmailCode: (email: string) => Promise<void>;
  verifyEmailCode: (email: string, code: string) => Promise<void>;
  saveProfile: (displayName: string, city: string, archeryClass?: string, discoverable?: boolean, extra?: ProfileExtra) => Promise<void>;
  block: (userId: string) => Promise<void>;
  unblock: (userId: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

// Your own full profile. Other people's private columns can't be read, so this
// comes from a database function (my_profile) rather than the profiles table.
function fetchMyProfile() {
  return supabase!.rpc("my_profile").maybeSingle();
}

/** Home state, and (once, at sign-up) confirmation that they're 13 or older. */
export interface ProfileExtra {
  homeState?: string | null;
  ageConfirmed?: boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [sessionChecked, setSessionChecked] = useState(!supabase);
  const [loadedFor, setLoadedFor] = useState<string | null>(null); // whose profile is loaded
  const [suggestedName, setSuggestedName] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (Platform.OS === "ios") AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => {});
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionChecked(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // Load the profile and block list whenever the signed-in person changes.
  useEffect(() => {
    if (!supabase) return;
    if (!userId) {
      setProfile(null);
      setBlocked(new Set());
      setLoadedFor(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const [{ data: p }, { data: b }] = await Promise.all([
        fetchMyProfile(),
        supabase!.from("blocks").select("blocked_id").eq("blocker_id", userId),
      ]);
      if (cancelled) return;
      setProfile((p as Profile) ?? null);
      setBlocked(new Set((b ?? []).map((r: { blocked_id: string }) => r.blocked_id)));
      setLoadedFor(userId);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const signInWithApple = useCallback(async () => {
    try {
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!cred.identityToken) throw new Error("Apple didn't return a sign-in token.");
      const name = [cred.fullName?.givenName, cred.fullName?.familyName?.charAt(0)].filter(Boolean).join(" ");
      if (name) setSuggestedName(name);
      const { error } = await supabase!.auth.signInWithIdToken({ provider: "apple", token: cred.identityToken });
      if (error) throw error;
      return "ok" as const;
    } catch (e: any) {
      if (e?.code === "ERR_REQUEST_CANCELED") return "cancelled" as const;
      throw e;
    }
  }, []);

  const sendEmailCode = useCallback(async (email: string) => {
    const { error } = await supabase!.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
    if (error) throw error;
  }, []);

  const verifyEmailCode = useCallback(async (email: string, code: string) => {
    const { error } = await supabase!.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    if (error) throw error;
  }, []);

  const saveProfile = useCallback(
    async (displayName: string, city: string, archeryClass = "", discoverable?: boolean, extra: ProfileExtra = {}) => {
      if (!userId) throw new Error("Not signed in");
      const row = {
        display_name: displayName.trim(),
        city: city.trim() || null,
        archery_class: archeryClass.trim() || null,
        ...(discoverable === undefined ? {} : { discoverable }),
        ...(extra.homeState === undefined ? {} : { home_state: extra.homeState }),
        ...(extra.ageConfirmed ? { age_confirmed_at: new Date().toISOString() } : {}),
      };
      // Update, or create the profile the first time. (An upsert would need read
      // access to the private columns, which the app doesn't have.)
      const { data: updated, error } = await supabase!.from("profiles").update(row).eq("id", userId).select("id");
      if (error) throw error;
      if (!updated?.length) {
        const { error: insertError } = await supabase!.from("profiles").insert({ id: userId, ...row });
        if (insertError) throw insertError;
      }
      const { data, error: readError } = await fetchMyProfile();
      if (readError) throw readError;
      setProfile(data as Profile);
    },
    [userId]
  );

  const block = useCallback(
    async (other: string) => {
      if (!userId) return;
      const { error } = await supabase!.from("blocks").upsert({ blocker_id: userId, blocked_id: other });
      if (error) throw error;
      setBlocked((cur) => new Set(cur).add(other));
    },
    [userId]
  );

  const unblock = useCallback(
    async (other: string) => {
      if (!userId) return;
      const { error } = await supabase!.from("blocks").delete().eq("blocker_id", userId).eq("blocked_id", other);
      if (error) throw error;
      setBlocked((cur) => {
        const next = new Set(cur);
        next.delete(other);
        return next;
      });
    },
    [userId]
  );

  const signOut = useCallback(async () => {
    await forgetPushToken(); // stop message notifications to this phone
    await supabase?.auth.signOut();
  }, []);

  // Removes the person's photos, then their account and everything linked to it.
  const deleteAccount = useCallback(async () => {
    if (!userId || !supabase) return;
    const bucket = supabase.storage.from(PHOTO_BUCKET);
    const { data: folders } = await bucket.list(userId, { limit: 1000 });
    for (const folder of folders ?? []) {
      const { data: files } = await bucket.list(`${userId}/${folder.name}`, { limit: 100 });
      const paths = (files ?? []).map((f) => `${userId}/${folder.name}/${f.name}`);
      if (paths.length) await bucket.remove(paths);
    }
    const { error } = await supabase.rpc("delete_my_account");
    if (error) throw error;
    await forgetPushToken(); // the database already removed this account's tokens
    await supabase.auth.signOut();
  }, [userId]);

  // Still working out who's signed in, or their profile hasn't arrived yet.
  const loading = !sessionChecked || (!!userId && loadedFor !== userId);

  const value = useMemo<AuthState>(
    () => ({
      enabled: !!supabase,
      loading,
      session,
      userId,
      profile,
      suggestedName,
      blocked,
      appleAvailable,
      signInWithApple,
      sendEmailCode,
      verifyEmailCode,
      saveProfile,
      block,
      unblock,
      signOut,
      deleteAccount,
    }),
    [loading, session, userId, profile, suggestedName, blocked, appleAvailable, signInWithApple, sendEmailCode, verifyEmailCode, saveProfile, block, unblock, signOut, deleteAccount]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
