// Push notifications: lets archers hear about a new message or friend request
// while the app is closed. The phone gets an address from Expo (a "push token")
// and saves it in Supabase; the database sends the notification itself when a
// message or friend request is added (see "Push notifications" in supabase/schema.sql).
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";
import { supabase } from "./supabase";

const TOKEN_KEY = "push.token.v1"; // the token this phone last saved, so sign-out can remove it
const CHANNEL_ID = "messages"; // must match 'channelId' in schema.sql

let savedThisLaunch: string | null = null; // "<user>:<token>", so we don't re-save on every screen
let openChatId: string | null = null; // the chat on screen right now, if any

/** The chat screen tells us which conversation is open, so we don't buzz for it. */
export function setOpenChat(conversationId: string | null) {
  openChatId = conversationId;
}

/** True for a new-message notification about the chat the archer is looking at. */
export function isAboutOpenChat(n: Notifications.Notification): boolean {
  const data = n.request.content.data as { type?: unknown; conversationId?: unknown } | undefined;
  return data?.type === "message" && !!openChatId && data.conversationId === openChatId;
}

async function ensureChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Messages and friend requests",
    importance: Notifications.AndroidImportance.HIGH,
  });
}

/**
 * Gets this phone's push token and saves it for the signed-in archer.
 * ask = false never shows the "Allow notifications?" question; it only refreshes the
 * token when the archer already said yes (for example to tournament reminders).
 */
async function register(userId: string, ask: boolean): Promise<void> {
  if (!supabase || Platform.OS === "web") return;
  try {
    await ensureChannel();
    let perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && ask && perm.canAskAgain) perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token || savedThisLaunch === `${userId}:${token}`) return;

    const { error } = await supabase.rpc("save_push_token", {
      new_token: token,
      new_device: Platform.OS === "ios" ? "ios" : "android",
    });
    if (error) return;
    savedThisLaunch = `${userId}:${token}`;
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Simulators, Expo Go on Android and phones with no signal can't get a token. Try again next time.
  }
}

/** Ask for permission (once) and save the token. Call at a moment where it makes sense to the archer. */
export function askForPushNotifications(userId: string | null): void {
  if (userId) register(userId, true);
}

/**
 * Stops notifications to this phone. Call before signing out (it needs the session
 * to remove the row). Deleting an account removes its tokens in the database too.
 */
export async function forgetPushToken(): Promise<void> {
  savedThisLaunch = null;
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    await AsyncStorage.removeItem(TOKEN_KEY);
    if (token && supabase) await supabase.from("push_tokens").delete().eq("token", token);
  } catch {
    // Best effort: signing out should never get stuck here.
  }
}

// Only paths the database sends; anything else in a notification is ignored.
function pushUrl(response: Notifications.NotificationResponse | null): string | null {
  const url = (response?.notification.request.content.data as { url?: unknown } | undefined)?.url;
  return typeof url === "string" && (/^\/chat\/[0-9a-f-]{36}$/i.test(url) || url === "/friends") ? url : null;
}

function openFrom(response: Notifications.NotificationResponse | null) {
  const url = pushUrl(response);
  if (url) router.push(url);
}

/**
 * Lives once in the root layout: keeps the signed-in archer's token fresh (without
 * asking), and opens the right screen when a notification is tapped.
 * userId: the signed-in archer once their profile is set up, otherwise null.
 */
export function usePushNotifications(userId: string | null) {
  useEffect(() => {
    if (userId) register(userId, false);
  }, [userId]);

  useEffect(() => {
    // Tapped while the app was closed: the tap that opened it.
    // Only our own message/friend notifications; reminders (tournaments, listings) are
    // opened by their own code, which also reads the last tapped notification.
    const first = Notifications.getLastNotificationResponse();
    if (first && pushUrl(first)) {
      Notifications.clearLastNotificationResponse();
      // Give the screens a moment to load before moving to the chat.
      setTimeout(() => openFrom(first), 300);
    }
    // Tapped while the app was open or in the background.
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      if (!pushUrl(r)) return;
      openFrom(r);
      Notifications.clearLastNotificationResponse();
    });
    return () => sub.remove();
  }, []);
}
