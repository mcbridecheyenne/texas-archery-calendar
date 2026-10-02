// Helpers the marketplace screens share.
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { Alert } from "react-native";
import { useAuth } from "../../lib/auth";
import { report } from "./api";
import type { ReportReason } from "./types";
import { showMenu } from "../../ui";

// Returns a function that checks the person can post/message, sending them to
// sign in or finish their profile first. Resolves true when they're ready.
export function useRequireMember(): () => boolean {
  const { enabled, userId, profile, loading } = useAuth();
  const router = useRouter();
  return useCallback(() => {
    if (!enabled) {
      Alert.alert("Coming soon", "The marketplace isn't open yet.");
      return false;
    }
    if (!userId) {
      router.push("/sign-in");
      return false;
    }
    if (loading) return false;
    if (!profile) {
      router.push("/setup-profile");
      return false;
    }
    return true;
  }, [enabled, userId, profile, loading, router]);
}

const REASONS: { id: ReportReason; label: string }[] = [
  { id: "scam", label: "Scam or fraud" },
  { id: "prohibited", label: "Not allowed (weapons, non-archery…)" },
  { id: "offensive", label: "Offensive or harassing" },
  { id: "spam", label: "Spam" },
  { id: "other", label: "Something else" },
];

// Asks why, files the report, and thanks the person. Reports go to the
// `reports` table in Supabase for review.
export function askToReport(reporterId: string | null, target: { listingId?: string; userId?: string; messageId?: number }) {
  if (!reporterId) {
    Alert.alert("Sign in to report", "Reports need an account so we can follow up.");
    return;
  }
  showMenu(
    "Why are you reporting this?",
    REASONS.map((r) => ({
      label: r.label,
      onPress: async () => {
        try {
          await report({ reporterId, reason: r.id, ...target });
          Alert.alert("Thanks for letting us know", "We'll review it within 24 hours and remove anything that breaks the rules.");
        } catch {
          Alert.alert("Couldn't send the report", "Please try again in a moment.");
        }
      },
    }))
  );
}

export function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d`;
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
}

export function memberSince(iso: string): string {
  const d = new Date(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `Member since ${months[d.getMonth()]} ${d.getFullYear()}`;
}
