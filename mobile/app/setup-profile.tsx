// Name, home state, city, archery class, and (the first time) confirming they're 13 or
// older and agreeing to the marketplace rules.
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { RULES_URL } from "../config";
import { StatePicker, stateName } from "../src/features/calendar";
import { checkListingText } from "../src/features/marketplace/moderation";
import { ARCHERY_CLASSES } from "../src/features/friends";
import { ageFrom, isMarkedUnder13, markUnder13 } from "../src/lib/age";
import { useAuth } from "../src/lib/auth";
import { useHomeState } from "../src/lib/homeState";
import { Button, Chip, Field, errorText, useTheme } from "../src/ui";

// Quick picks; archers can type any class their association uses.
const CLASS_IDEAS = ARCHERY_CLASSES;

export default function SetupProfileScreen() {
  const t = useTheme();
  const router = useRouter();
  const { profile, suggestedName, saveProfile, userId, deleteAccount } = useAuth();
  const home = useHomeState();
  const firstTime = !profile;
  // Asked once: at sign-up, or the next time someone who signed up before the age question edits their profile.
  const askAge = !profile?.age_confirmed_at;
  const [homeState, setHomeStateField] = useState<string | null>(profile?.home_state ?? home.homeState);
  const [pickingState, setPickingState] = useState(false);
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [under13, setUnder13] = useState(false);
  useEffect(() => {
    isMarkedUnder13().then(setUnder13);
  }, []);
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
    if (!homeState) {
      Alert.alert("Pick your home state", "The calendar opens on tournaments in your state. You can still look at any state.");
      return;
    }
    if (askAge) {
      const m = Number(birthMonth);
      const y = Number(birthYear);
      const thisYear = new Date().getFullYear();
      if (!Number.isInteger(m) || m < 1 || m > 12 || !Number.isInteger(y) || y < thisYear - 120 || y > thisYear) {
        Alert.alert("Add your birthday", "Enter the month (1 to 12) and the four-digit year you were born.");
        return;
      }
      if (ageFrom(m, y) < 13) {
        await markUnder13();
        setUnder13(true);
        // Remove the sign-in they just made, so nothing about them is kept.
        await deleteAccount().catch(() => {});
        return;
      }
    }
    if (!agreed) {
      Alert.alert("One more thing", "Please agree to the marketplace rules to continue.");
      return;
    }
    try {
      setBusy(true);
      await saveProfile(name, city, archeryClass, discoverable, { homeState, ageConfirmed: askAge });
      await home.setHomeState(homeState);
      if (router.canGoBack()) router.back();
      else router.replace("/");
    } catch (e) {
      Alert.alert("Couldn't save", errorText(e));
    } finally {
      setBusy(false);
    }
  }

  if (under13) {
    return (
      <View style={[styles.content, { backgroundColor: t.background, flex: 1 }]}>
        <Text style={[styles.title, { color: t.text }]}>Sorry!</Text>
        <Text style={[styles.lead, { color: t.muted, marginTop: 0 }]}>
          Accounts are for archers 13 and older. You can still look up tournaments, mark the ones you're going to, and get
          reminders without an account.
        </Text>
        <Button title="Back to tournaments" onPress={() => router.replace("/")} />
      </View>
    );
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
      <View style={{ gap: 6 }}>
        <Text style={[styles.label, { color: t.muted }]}>Home state</Text>
        <Pressable
          onPress={() => setPickingState(true)}
          style={[styles.picker, { borderColor: t.border, backgroundColor: t.card }]}
          accessibilityRole="button"
          accessibilityLabel={`Home state: ${stateName(homeState) ?? "not picked"}. Change`}
        >
          <Text style={{ color: homeState ? t.text : t.muted, fontSize: 16, flex: 1 }}>{stateName(homeState) ?? "Pick your state"}</Text>
          <Text style={{ color: t.primary, fontWeight: "600" }}>▾</Text>
        </Pressable>
        <Text style={[styles.hint, { color: t.muted }]}>The calendar opens on tournaments in your state.</Text>
      </View>
      <StatePicker
        visible={pickingState}
        value={homeState}
        theme={t}
        title="Your home state"
        onClose={() => setPickingState(false)}
        onPick={(code) => {
          setHomeStateField(code);
          setPickingState(false);
        }}
      />
      {askAge ? (
        <View style={{ gap: 6 }}>
          <Text style={[styles.label, { color: t.muted }]}>Your birthday</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label="Month" value={birthMonth} onChangeText={setBirthMonth} placeholder="MM" keyboardType="number-pad" maxLength={2} />
            </View>
            <View style={{ flex: 2 }}>
              <Field label="Year" value={birthYear} onChangeText={setBirthYear} placeholder="YYYY" keyboardType="number-pad" maxLength={4} />
            </View>
          </View>
          <Text style={[styles.hint, { color: t.muted }]}>Only used to check you're old enough for an account. It isn't saved or shown.</Text>
        </View>
      ) : null}
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
  label: { fontSize: 13, fontWeight: "600" },
  picker: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12 },
});
