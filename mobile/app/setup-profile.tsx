// Name, city, archery class, and (the first time) agreeing to the marketplace rules.
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { RULES_URL } from "../config";
import { checkListingText } from "../src/features/marketplace/moderation";
import { useAuth } from "../src/lib/auth";
import { Button, Chip, Field, errorText, useTheme } from "../src/ui";

// Quick picks; archers can type any class their association uses.
const CLASS_IDEAS = ["Open Pro", "Known 50", "Known 45", "Senior Open", "Hunter", "Bowhunter Freestyle", "Freestyle", "Barebow", "Traditional", "Youth"];

export default function SetupProfileScreen() {
  const t = useTheme();
  const router = useRouter();
  const { profile, suggestedName, saveProfile, userId } = useAuth();
  const firstTime = !profile;
  const [name, setName] = useState(profile?.display_name ?? suggestedName ?? "");
  const [city, setCity] = useState(profile?.city ?? "");
  const [archeryClass, setArcheryClass] = useState(profile?.archery_class ?? "");
  // New archers start searchable (they can switch it off right here); existing ones keep their choice.
  const [discoverable, setDiscoverable] = useState(profile ? !!profile.discoverable : true);
  const [agreed, setAgreed] = useState(!firstTime);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (name.trim().length < 2) {
      Alert.alert("Add your name", "Use at least 2 letters. First name and last initial works well.");
      return;
    }
    if (checkListingText(name, `${city} ${archeryClass}`)) {
      Alert.alert("Pick a different name", "Please keep names respectful.");
      return;
    }
    if (!agreed) {
      Alert.alert("One more thing", "Please agree to the marketplace rules to continue.");
      return;
    }
    try {
      setBusy(true);
      await saveProfile(name, city, archeryClass, discoverable);
      if (router.canGoBack()) router.back();
      else router.replace("/");
    } catch (e) {
      Alert.alert("Couldn't save", errorText(e));
    } finally {
      setBusy(false);
    }
  }

  if (!userId) return null;

  return (
    <ScrollView style={{ backgroundColor: t.background }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {firstTime ? (
        <>
          <Text style={[styles.title, { color: t.text }]}>Welcome!</Text>
          <Text style={[styles.lead, { color: t.muted }]}>This is what friends, buyers and sellers see. Your email stays private.</Text>
        </>
      ) : null}
      <Field label="Name" value={name} onChangeText={setName} placeholder="Cheyenne M." maxLength={40} autoCapitalize="words" />
      <Field label="City (optional)" value={city} onChangeText={setCity} placeholder="Wichita Falls" maxLength={60} autoCapitalize="words" />
      <View style={{ gap: 8 }}>
        <Field
          label="Archery class (optional)"
          value={archeryClass}
          onChangeText={setArcheryClass}
          placeholder="Known 50"
          maxLength={40}
          autoCapitalize="words"
          hint="Shown next to your name when you share that you're going to a tournament."
        />
        <View style={styles.ideas}>
          {CLASS_IDEAS.map((c) => (
            <Chip key={c} label={c} active={archeryClass === c} onPress={() => setArcheryClass((cur) => (cur === c ? "" : c))} />
          ))}
        </View>
      </View>

      <View style={[styles.agree, { borderColor: t.border, backgroundColor: t.card, alignItems: "center" }]}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.agreeText, { color: t.text, fontWeight: "700" }]}>Let other archers find me by name</Text>
          <Text style={[styles.hint, { color: t.muted }]}>
            {discoverable
              ? "Archers can search for your name to send you a friend request. You choose whether to accept."
              : "You won't show up in search. Friends can still add you with your friend code."}
          </Text>
        </View>
        <Switch
          value={discoverable}
          onValueChange={setDiscoverable}
          trackColor={{ true: t.primary, false: t.border }}
          accessibilityLabel="Let other archers find me by name"
        />
      </View>

      {firstTime ? (
        <Pressable onPress={() => setAgreed((v) => !v)} style={[styles.agree, { borderColor: t.border, backgroundColor: t.card }]} accessibilityRole="checkbox" accessibilityState={{ checked: agreed }}>
          <View style={[styles.box, { borderColor: agreed ? t.primary : t.muted, backgroundColor: agreed ? t.primary : "transparent" }]}>
            {agreed ? <Text style={{ color: t.onPrimary, fontWeight: "900" }}>✓</Text> : null}
          </View>
          <Text style={[styles.agreeText, { color: t.text }]}>
            I agree to the{" "}
            <Text style={{ color: t.primary, fontWeight: "700" }} onPress={() => Linking.openURL(RULES_URL)}>
              marketplace rules
            </Text>
            : archery gear only, no scams, harassment or offensive content. Breaking them gets listings removed and accounts banned.
          </Text>
        </Pressable>
      ) : null}

      <Button title={firstTime ? "Continue" : "Save"} onPress={save} busy={busy} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 22, gap: 16 },
  title: { fontSize: 28, fontWeight: "800" },
  lead: { fontSize: 15, lineHeight: 21, marginTop: -6 },
  agree: { flexDirection: "row", gap: 12, padding: 14, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: "center", justifyContent: "center", marginTop: 1 },
  agreeText: { flex: 1, fontSize: 14, lineHeight: 20 },
  ideas: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  hint: { fontSize: 13, lineHeight: 18 },
});
