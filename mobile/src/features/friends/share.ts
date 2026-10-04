// The "who can see you're going?" question, and invite links.
import { ActionSheetIOS, Alert, Platform, Share } from "react-native";
import { API_BASE_URL } from "../../../config";
import type { AddFriendResult, ShareLevel } from "./types";

const CHOICES: { level: ShareLevel; label: string }[] = [
  { level: "friends", label: "My friends" },
  { level: "public", label: "Everyone in the app" },
  { level: "private", label: "Just me (don't share)" },
];

/** Asks who can see that you're going. Resolves null if the archer cancels. */
export function askShareLevel(eventName: string): Promise<ShareLevel | null> {
  return new Promise((resolve) => {
    const title = "Who can see you're going?";
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { title, message: eventName, options: [...CHOICES.map((c) => c.label), "Cancel"], cancelButtonIndex: CHOICES.length },
        (i) => resolve(i < CHOICES.length ? CHOICES[i].level : null)
      );
    } else {
      // Android dialogs hold three buttons; tapping outside cancels.
      Alert.alert(
        title,
        eventName,
        CHOICES.map((c) => ({ text: c.label, onPress: () => resolve(c.level) })),
        { cancelable: true, onDismiss: () => resolve(null) }
      );
    }
  });
}

/** A web link that opens the app's Add Friend screen (and shows the code if the app isn't installed). */
export function inviteLink(code: string): string {
  return `${API_BASE_URL}/friend.html?code=${encodeURIComponent(code)}`;
}

export async function shareInvite(code: string): Promise<void> {
  await Share.share({
    message: `Add me as a friend on Archery in the USA so we can see who's going to which shoots! My friend code is ${code}.\n${inviteLink(code)}`,
  });
}

/** Turns what someone typed or pasted (a code or an invite link) into a bare code. */
export function cleanCode(input: string): string {
  const fromLink = input.match(/code=([A-Za-z0-9-]+)/)?.[1] ?? input.match(/add-friend\/([A-Za-z0-9-]+)/)?.[1];
  return (fromLink ?? input).replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/** Title and message to show after adding a friend by code. */
export function addResultMessage(r: AddFriendResult): [string, string] {
  if (r.status === "accepted") return ["You're friends!", `You and ${r.name} are now friends.`];
  if (r.status === "already_friends") return ["Already friends", `You and ${r.name} are already friends.`];
  if (r.status === "already_sent") return ["Request already sent", `Waiting for ${r.name} to accept.`];
  return ["Request sent", `${r.name} will see your request next time they open the app.`];
}
