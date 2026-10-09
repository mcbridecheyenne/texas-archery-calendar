// Sign-in state for the whole app: the Supabase session, the person's public
// profile, and who they've blocked. Browsing never needs an account; posting
// and messaging do.
import * as AppleAuthentication from "expo-apple-authentication";
import { REVIEW_ACCOUNT_EMAIL } from "../../config";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AppState, Platform } from "react-native";
import type { Session } from "@supabase/supabase-js";
import type { Profile } from "../features/marketplace/types";
import { forgetPushToken } from "./push";
import { supabase } from "./supabase";

export interface AuthState {
  enabled: boolean; // marketplace configured
  loading: boolean;
  session: Session | null;
  userId: string | null;
  profile: Profile | null; // null until they finish setup
  suggestedName: string | null; // from Sign in with Apple, to prefill setup
  blocked: Set<string>;
  loadError: boolean; // the profile or block list couldn't be loaded (weak signal); profile is NOT "missing"
  retryLoad: () => void;
  appleAvailable: boolean;
  signInWithApple: () => Promise<"ok" | "cancelled">;
  sendEmailCode: (email: string) => Promise<void>;
  verifyEmailCode: (email: string, code: string) => Promise<void>;
  saveProfile: (displayName: string, city: string, archeryClass?: string, discoverable?: boolean, extra?: ProfileExtra) => Promise<void>;
  block: (userId: string) => Promise<void>;
  unblock: (userId: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** "cancelled" when they backed out of the Apple confirmation. */
  deleteAccount: () => Promise<"deleted" | "cancelled">;
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

function isReviewAccount(email: string) {
  return email.trim().toLowerCase() === REVIEW_ACCOUNT_EMAIL.toLowerCase();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [sessionChecked, setSessionChecked] = useState(!supabase);
  const [loadedFor, setLoadedFor] = useState<string | null>(null); // whose profile is loaded
  const [suggestedName, setSuggestedName] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [retryTick, setRetryTick] = useState(0); // bump to load the profile and block list again
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
      setLoadError(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const [{ data: p, error: profileError }, { data: b, error: blocksError }] = await Promise.all([
        fetchMyProfile(),
        supabase!.from("blocks").select("blocked_id").eq("blocker_id", userId),
      ]);
      if (cancelled) return;
      // A failed load is not "no profile": keep what we had and let it be retried.
      if (!profileError) setProfile((p as Profile) ?? null);
      if (!blocksError) setBlocked(new Set((b ?? []).map((r: { blocked_id: string }) => r.blocked_id)));
      setLoadError(!!profileError || !!blocksError);
      setLoadedFor(userId);
    })().catch(() => {
      if (cancelled) return;
      setLoadError(true);
      setLoadedFor(userId);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, retryTick]);

  const retryLoad = useCallback(() => setRetryTick((n) => n + 1), []);

  // Back on screen after a weak-signal start: try the profile and block list again.
  useEffect(() => {
    if (!loadError) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") retryLoad();
    });
    return () => sub.remove();
  }, [loadError, retryLoad]);

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
    if (isReviewAccount(email)) return; // the reviewer types a password instead of a code
    const { error } = await supabase!.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
    if (error) throw error;
  }, []);

  const verifyEmailCode = useCallback(async (email: string, code: string) => {
    const { error } = isReviewAccount(email)
      ? await supabase!.auth.signInWithPassword({ email: email.trim(), password: code.trim() })
      : await supabase!.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
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
  // The delete-account edge function removes their photos on the server and deletes the
  // account. Sign in with Apple accounts confirm with Apple once more first: that gives a
  // one-time code the server uses to remove the app from their Apple ID, as Apple asks.
  const deleteAccount = useCallback(async (): Promise<"deleted" | "cancelled"> => {
    if (!userId || !supabase) return "cancelled";
    const user = session?.user;
    const usesApple = user?.app_metadata?.provider === "apple" || !!user?.identities?.some((i) => i.provider === "apple");
    let appleAuthorizationCode: string | undefined;
    if (usesApple && Platform.OS === "ios") {
      try {
        const cred = await AppleAuthentication.signInAsync({ requestedScopes: [] });
        appleAuthorizationCode = cred.authorizationCode ?? undefined;
      } catch (e: any) {
        if (e?.code === "ERR_REQUEST_CANCELED") return "cancelled";
        throw e;
      }
    }
    const { data, error } = await supabase.functions.invoke("delete-account", { body: { appleAuthorizationCode } });
    if (error || !data?.ok) {
      const res = (error as any)?.context;
      const body = res && typeof res.json === "function" ? await res.json().catch(() => null) : data;
      throw new Error(body?.message ?? "Couldn't delete your account. Check your connection and try again.");
    }
    await forgetPushToken(); // the database already removed this account's tokens
    await supabase.auth.signOut();
    return "deleted";
  }, [userId, session]);

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
      loadError,
      retryLoad,
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
    [loading, session, userId, profile, suggestedName, blocked, loadError, retryLoad, appleAvailable, signInWithApple, sendEmailCode, verifyEmailCode, saveProfile, block, unblock, signOut, deleteAccount]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
