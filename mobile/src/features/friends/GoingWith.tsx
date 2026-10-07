// Shown in a tournament's detail sheet: who you're sharing with, and which
// friends (and other archers who shared publicly) are going.
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../lib/auth";
import { errorText, useTheme } from "../../ui";
import { askAboutPerson } from "../marketplace/helpers";
import type { TournamentEvent } from "../calendar";
import { fetchAttendees } from "./api";
import { useFriends } from "./FriendsProvider";
import { askShareLevel } from "./share";
import { shareLabel, type Attendee } from "./types";

export function GoingWith({ event, going, close }: { event: TournamentEvent; going: boolean; close: () => void }) {
  const t = useTheme();
  const router = useRouter();
  const auth = useAuth();
  const fr = useFriends();
  const [people, setPeople] = useState<Attendee[] | null>(null);
  const level = fr.shareLevelFor(event.id);

  useEffect(() => {
    if (!fr.active || !auth.userId) return;
    let cancelled = false;
    setPeople(null);
    fetchAttendees(auth.userId, event.id, fr.friendIds)
      .then((list) => !cancelled && setPeople(list.filter((p) => !auth.blocked.has(p.userId))))
      .catch(() => !cancelled && setPeople([]));
    return () => {
      cancelled = true;
    };
  }, [fr.active, auth.userId, auth.blocked, event.id, fr.friendIds]);

  if (!auth.enabled) return null;

  const go = (path: "/sign-in" | "/setup-profile" | "/friends") => {
    close();
    setTimeout(() => router.push(path), 350); // let the sheet slide away first
  };

  if (!fr.active) {
    return (
      <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
        <Text style={[styles.h, { color: t.text }]}>See which friends are going</Text>
        <Text style={[styles.p, { color: t.muted }]}>Sign in to add friends and share the shoots you're going to.</Text>
        <Pressable onPress={() => go(auth.userId ? "/setup-profile" : "/sign-in")} hitSlop={8} accessibilityRole="button">
          <Text style={[styles.link, { color: t.primary }]}>{auth.userId ? "Finish your profile" : "Sign in"}</Text>
        </Pressable>
      </View>
    );
  }

  async function changeLevel() {
    const next = await askShareLevel(event.name);
    if (!next || next === level) return;
    fr.setShareLevel(event, next).catch((e) => Alert.alert("Couldn't change who can see this", errorText(e)));
  }

  const friends = (people ?? []).filter((p) => p.isFriend);
  const others = (people ?? []).filter((p) => !p.isFriend);

  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      {going ? (
        <Pressable onPress={changeLevel} style={styles.shareRow} accessibilityRole="button" accessibilityLabel={`Shared with ${shareLabel(level)}. Change`}>
          <Text style={[styles.p, { color: t.muted, flex: 1 }]}>
            You're going · shared with <Text style={{ color: t.text, fontWeight: "700" }}>{shareLabel(level)}</Text>
          </Text>
          <Text style={[styles.link, { color: t.primary }]}>Change</Text>
        </Pressable>
      ) : null}

      <Text style={[styles.h, { color: t.text }]}>Friends going{people ? ` (${friends.length})` : ""}</Text>
      {people === null ? (
        <ActivityIndicator color={t.primary} style={{ alignSelf: "flex-start" }} />
      ) : friends.length ? (
        <Names list={friends} onPerson={(p) => askAboutPerson(p.name, p.userId, auth.userId, auth.block)} />
      ) : (
        <Text style={[styles.p, { color: t.muted }]}>
          {fr.friends.length ? "None of your friends have shared this one yet." : "Add friends to see who's going."}
        </Text>
      )}

      {others.length ? (
        <>
          <Text style={[styles.h, { color: t.text, marginTop: 6 }]}>Other archers going ({others.length})</Text>
          <Names list={others} onPerson={(p) => askAboutPerson(p.name, p.userId, auth.userId, auth.block)} />
        </>
      ) : null}

      <Pressable onPress={() => go("/friends")} hitSlop={8} accessibilityRole="button">
        <Text style={[styles.link, { color: t.primary }]}>{fr.friends.length ? "Friends" : "Add friends"}</Text>
      </Pressable>
    </View>
  );
}

// Tap a name to report or block that archer.
function Names({ list, onPerson }: { list: Attendee[]; onPerson: (p: Attendee) => void }) {
  const t = useTheme();
  return (
    <View style={styles.names}>
      {list.map((p) => (
        <Pressable
          key={p.userId}
          onPress={() => onPerson(p)}
          accessibilityRole="button"
          accessibilityLabel={`${p.name}. Report or block`}
          style={[styles.person, { backgroundColor: t.subtle }]}
        >
          <View style={[styles.avatar, { backgroundColor: t.primary }]}>
            <Text style={{ color: t.onPrimary, fontWeight: "800", fontSize: 12 }}>{p.name.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={[styles.personName, { color: t.text }]} numberOfLines={1}>
            {p.name}
            {p.archeryClass ? <Text style={{ color: t.muted, fontWeight: "500" }}> · {p.archeryClass}</Text> : null}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 14, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 8 },
  shareRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 4 },
  h: { fontSize: 15, fontWeight: "700" },
  p: { fontSize: 14, lineHeight: 19 },
  link: { fontSize: 14, fontWeight: "700" },
  names: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  person: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4, paddingLeft: 4, paddingRight: 10, borderRadius: 999, maxWidth: "100%" },
  avatar: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  personName: { fontSize: 14, fontWeight: "600", flexShrink: 1 },
});
