// Friends: your friend code and invite link, adding by code, requests, and your friends list.
import { useRouter } from "expo-router";
import { useState, type ReactNode } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { addResultMessage, cleanCode, shareInvite, useFriends, type Friend } from "../src/features/friends";
import { useAuth } from "../src/lib/auth";
import { Button, Empty, Field, SectionLabel, confirm, errorText, showMenu, useTheme } from "../src/ui";

export default function FriendsScreen() {
  const t = useTheme();
  const router = useRouter();
  const auth = useAuth();
  const fr = useFriends();
  const [code, setCode] = useState("");
  const [adding, setAdding] = useState(false);

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

      <SectionLabel>Add a friend</SectionLabel>
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

function Person({ f, children, onPress }: { f: Friend; children: ReactNode; onPress?: () => void }) {
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
});
