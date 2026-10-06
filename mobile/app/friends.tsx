// Friends: your friend code and invite link, adding by code, requests, and your friends list.
import { useRouter } from "expo-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ARCHERY_CLASSES, addResultMessage, cleanCode, searchArchers, shareInvite, useFriends, type Friend, type SearchResult } from "../src/features/friends";
import { useAuth } from "../src/lib/auth";
import { askForPushNotifications } from "../src/lib/push";
import { Button, Chip, Empty, Field, SectionLabel, confirm, errorText, showMenu, useTheme } from "../src/ui";

export default function FriendsScreen() {
  const t = useTheme();
  const router = useRouter();
  const auth = useAuth();
  const fr = useFriends();
  const [code, setCode] = useState("");
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [klass, setKlass] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const searchId = useRef(0);

  // Search a moment after typing stops. Friend lists changing (accept/add) refresh the results too.
  const friendKey = `${fr.friends.length}-${fr.incoming.length}-${fr.outgoing.length}`;
  useEffect(() => {
    const term = q.trim();
    if ((term.length < 2 && !klass) || !auth.profile) {
      setResults(null);
      setSearching(false);
      return;
    }
    const id = ++searchId.current;
    setSearching(true);
    const timer = setTimeout(() => {
      searchArchers(term, klass)
        .then((r) => id === searchId.current && setResults(r))
        .catch(() => id === searchId.current && setResults([]))
        .finally(() => id === searchId.current && setSearching(false));
    }, 350);
    return () => clearTimeout(timer);
  }, [q, klass, auth.profile, friendKey]);

  // Ask (once) to send notifications for new friend requests.
  useEffect(() => {
    if (auth.profile) askForPushNotifications(auth.userId);
  }, [auth.userId, auth.profile]);

  if (!auth.enabled) return <Empty title="Friends" body="Friends open with accounts." />;
  if (!auth.userId)
    return (
      <Empty
        title="Add friends"
        body="Sign in to add friends and see which shoots they're going to."
        action={<Button title="Sign in" onPress={() => router.push("/sign-in")} />}
      />
    );
  if (!auth.profile)
    return <Empty title="Finish your profile" body="Pick a name so friends can find you." action={<Button title="Set up profile" onPress={() => router.push("/setup-profile")} />} />;

  async function add() {
    const c = cleanCode(code);
    if (c.length < 4) {
      Alert.alert("Enter a friend code", "Ask your friend for the code on their Friends screen.");
      return;
    }
    try {
      setAdding(true);
      const r = await fr.addByCode(c);
      setCode("");
      Alert.alert(...addResultMessage(r));
    } catch (e) {
      Alert.alert("Couldn't add friend", errorText(e));
    } finally {
      setAdding(false);
    }
  }

  async function addFound(r: SearchResult) {
    try {
      setBusyId(r.id);
      if (r.relation === "received") await fr.accept(r.id);
      else Alert.alert(...addResultMessage(await fr.addById(r.id)));
    } catch (e) {
      Alert.alert("Couldn't add friend", errorText(e));
    } finally {
      setBusyId(null);
    }
  }

  function friendMenu(f: Friend) {
    showMenu(f.name, [
      {
        label: "Remove friend",
        destructive: true,
        onPress: () => confirm(`Remove ${f.name}?`, "You'll stop seeing each other's shared tournaments.", "Remove", () => fr.remove(f.id).catch((e) => Alert.alert("Couldn't remove", errorText(e)))),
      },
      {
        label: "Block",
        destructive: true,
        onPress: () => confirm(`Block ${f.name}?`, "This also removes them as a friend. They can't message you or add you again.", "Block", () => auth.block(f.id).catch((e) => Alert.alert("Couldn't block", errorText(e)))),
      },
    ]);
  }

  return (
    <ScrollView style={{ backgroundColor: t.background }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
        <Text style={[styles.label, { color: t.muted }]}>YOUR FRIEND CODE</Text>
        <Text selectable style={[styles.code, { color: t.text }]} accessibilityLabel={`Your friend code is ${fr.friendCode ?? "loading"}`}>
          {fr.friendCode ?? "······"}
        </Text>
        <Button title="Invite friends" onPress={() => fr.friendCode && shareInvite(fr.friendCode)} disabled={!fr.friendCode} />
      </View>

      <SectionLabel>Find archers</SectionLabel>
      <Field
        label="Search by name"
        value={q}
        onChangeText={setQ}
        placeholder="e.g. Kim R."
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
        hint={auth.profile.discoverable ? undefined : "You're hidden from search. To let friends find you, turn it on in Account → Edit profile."}
      />
      <Text style={[styles.p, { color: t.muted }]}>Filter by class</Text>
      <View style={styles.classes}>
        {ARCHERY_CLASSES.map((c) => (
          <Chip key={c} label={c} active={klass === c} onPress={() => setKlass((cur) => (cur === c ? null : c))} />
        ))}
      </View>
      {searching ? <ActivityIndicator color={t.primary} style={{ marginVertical: 8 }} /> : null}
      {!searching && results !== null ? (
        results.length ? (
          results.map((r) => (
            <Person key={r.id} f={{ name: r.name, city: r.city, archeryClass: r.archeryClass }}>
              {r.relation === "friends" ? (
                <Text style={{ color: t.muted, fontWeight: "700" }}>Friends ✓</Text>
              ) : r.relation === "sent" ? (
                <Text style={{ color: t.muted, fontWeight: "700" }}>Requested</Text>
              ) : (
                <Button small title={r.relation === "received" ? "Accept" : "Add"} busy={busyId === r.id} onPress={() => addFound(r)} />
              )}
            </Person>
          ))
        ) : (
          <Text style={[styles.p, { color: t.muted }]}>
            {klass && q.trim().length < 2
              ? `No searchable archers in ${klass} yet.`
              : "No archers found. They may have turned off search; ask for their friend code instead."}
          </Text>
        )
      ) : null}

      <SectionLabel>Add by friend code</SectionLabel>
      <View style={styles.addRow}>
        <View style={{ flex: 1 }}>
          <Field
            label="Their friend code"
            value={code}
            onChangeText={setCode}
            placeholder="ABC234"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={80}
            onSubmitEditing={add}
            returnKeyType="done"
          />
        </View>
        <View style={{ paddingTop: 22 }}>
          <Button title="Add" onPress={add} busy={adding} />
        </View>
      </View>

      {fr.incoming.length ? (
        <>
          <SectionLabel>{`Requests (${fr.incoming.length})`}</SectionLabel>
          {fr.incoming.map((f) => (
            <Person key={f.id} f={f}>
              <Button small title="Accept" onPress={() => fr.accept(f.id).catch((e) => Alert.alert("Couldn't accept", errorText(e)))} />
              <Button small kind="secondary" title="Decline" onPress={() => fr.remove(f.id).catch(() => {})} />
            </Person>
          ))}
        </>
      ) : null}

      <SectionLabel>{`Friends (${fr.friends.length})`}</SectionLabel>
      {fr.friends.length ? (
        fr.friends.map((f) => (
          <Person key={f.id} f={f} onPress={() => friendMenu(f)}>
            <Text style={{ color: t.muted, fontSize: 18 }}>•••</Text>
          </Person>
        ))
      ) : (
        <Text style={[styles.p, { color: t.muted }]}>
          No friends yet. Tap Invite friends to text them your code, or enter theirs above.
        </Text>
      )}

      {fr.outgoing.length ? (
        <>
          <SectionLabel>Waiting to accept</SectionLabel>
          {fr.outgoing.map((f) => (
            <Person key={f.id} f={f}>
              <Button small kind="secondary" title="Cancel" onPress={() => fr.remove(f.id).catch(() => {})} />
            </Person>
          ))}
        </>
      ) : null}

      <Text style={[styles.p, { color: t.muted, marginTop: 18 }]}>
        When you mark a tournament Going, you choose who sees it: your friends, everyone in the app, or just you.
      </Text>
    </ScrollView>
  );
}

function Person({ f, children, onPress }: { f: Pick<Friend, "name" | "city" | "archeryClass">; children: ReactNode; onPress?: () => void }) {
  const t = useTheme();
  const body = (
    <View style={[styles.person, { backgroundColor: t.card, borderColor: t.border }]}>
      <View style={[styles.avatar, { backgroundColor: t.primary }]}>
        <Text style={{ color: t.onPrimary, fontWeight: "800", fontSize: 18 }}>{f.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>
          {f.name}
        </Text>
        {f.archeryClass || f.city ? (
          <Text style={[styles.p, { color: t.muted }]} numberOfLines={1}>
            {[f.archeryClass, f.city].filter(Boolean).join(" · ")}
          </Text>
        ) : null}
      </View>
      <View style={styles.actions}>{children}</View>
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${f.name}, options`}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40, gap: 8 },
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 10, alignItems: "stretch" },
  label: { fontSize: 12, fontWeight: "700", letterSpacing: 1.2, textAlign: "center" },
  code: { fontSize: 34, fontWeight: "800", letterSpacing: 6, textAlign: "center", fontVariant: ["tabular-nums"] },
  addRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  person: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 16, fontWeight: "700" },
  p: { fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: "row", gap: 8, alignItems: "center" },
  classes: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
