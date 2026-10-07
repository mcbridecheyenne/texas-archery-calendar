// The add/edit form for an archer-added tournament, with a duplicate check before saving.
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, Field, errorText, useTheme } from "../../ui";
import type { TournamentEvent } from "../calendar";
import { fmtRange } from "../calendar/dates";
import { checkListingText } from "../marketplace/moderation";
import type { CommunityEventInput } from "./api";
import { findLikelyDuplicates } from "./duplicates";
import { useCommunity } from "./CommunityProvider";
import { useHomeState } from "../../lib/homeState";

const US_STATES = new Set(
  ("AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC").split(" ")
);

function toUS(iso: string | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}

/** "3/7/2027" or "03/07/27" → "2027-03-07", or null if it isn't a real date. */
export function parseUSDate(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysBetween(a: string, b: string): number {
  const p = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d) / 86400000;
  };
  return p(b) - p(a);
}

export function TournamentForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: TournamentEvent | null;
  submitLabel: string;
  onSubmit: (input: CommunityEventInput) => Promise<void>;
}) {
  const t = useTheme();
  const { everything } = useCommunity();
  const { homeState } = useHomeState();
  const [name, setName] = useState(initial?.name ?? "");
  const [start, setStart] = useState(toUS(initial?.startDate));
  const [end, setEnd] = useState(initial && initial.endDate !== initial.startDate ? toUS(initial.endDate) : "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [stateCode, setStateCode] = useState((initial?.state ?? homeState ?? "").toUpperCase());
  const [host, setHost] = useState(initial?.contact ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [url, setUrl] = useState(initial?.sourceUrl ?? "");
  const [details, setDetails] = useState(initial?.details ?? "");
  // The flyer picture: the saved one (path + url), a newly picked one (uri), or none.
  const [flyer, setFlyer] = useState<(NonNullable<CommunityEventInput["flyer"]> & { preview?: string }) | null>(
    initial?.flyerPath ? { path: initial.flyerPath, preview: initial.flyerUrl ?? undefined } : null
  );

  async function pickFlyer(fromCamera: boolean) {
    try {
      let result: ImagePicker.ImagePickerResult;
      if (fromCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Camera access is off", "Allow camera access in Settings to take a photo of the flyer.", [
            { text: "Not now", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ]);
          return;
        }
        result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
      }
      if (result.canceled || !result.assets[0]) return;
      const a = result.assets[0];
      setFlyer({ uri: a.uri, width: a.width, height: a.height, preview: a.uri });
    } catch (e) {
      Alert.alert("Couldn't add the flyer", errorText(e));
    }
  }
  const [busy, setBusy] = useState(false);

  function problem(): string | CommunityEventInput {
    if (name.trim().length < 3) return "Add the tournament's name.";
    const startDate = parseUSDate(start);
    if (!startDate) return "Enter the start date like 03/14/2027.";
    const endDate = end.trim() ? parseUSDate(end) : startDate;
    if (!endDate) return "Enter the end date like 03/15/2027, or leave it blank for a one-day shoot.";
    if (endDate < startDate) return "The end date is before the start date.";
    if (daysBetween(startDate, endDate) > 14) return "Tournaments can be up to two weeks long.";
    if (!initial && startDate < todayIso()) return "That date has already passed.";
    if (location.trim().length < 2) return "Add where it is: the range or club name, and the address if you have it.";
    if (city.trim().length < 2) return "Add the town.";
    const st = stateCode.trim().toUpperCase();
    if (!US_STATES.has(st)) return "Enter the state as two letters, like TX or PA.";
    let link = url.trim();
    if (link && !/^https?:\/\//i.test(link)) link = `https://${link}`;
    if (link && !/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(link)) return "That website link doesn't look right.";
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) return "That email doesn't look right.";
    if (checkListingText(name, `${details} ${location} ${host}`)) return "Please keep it to archery and keep it respectful.";
    const flyerInput = flyer ? { path: flyer.path, uri: flyer.uri, width: flyer.width, height: flyer.height } : null;
    return { name, startDate, endDate, location, city, state: st, host, phone, email: email.trim(), url: link, details, flyer: flyerInput };
  }

  async function save(input: CommunityEventInput) {
    try {
      setBusy(true);
      await onSubmit(input);
    } catch (e) {
      Alert.alert("Couldn't save", errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    const result = problem();
    if (typeof result === "string") {
      Alert.alert("Almost there", result);
      return;
    }
    const dupes = findLikelyDuplicates(result, await everything(), initial?.id).slice(0, 3);
    if (!dupes.length) return save(result);
    const list = dupes.map((d) => `• ${d.name} (${fmtRange(d.startDate, d.endDate)}${d.city ? `, ${d.city}` : ""})`).join("\n");
    Alert.alert(
      "This might already be listed",
      `These look like the same tournament:\n\n${list}\n\nIf it's one of these, you can mark it Going there instead.`,
      [
        { text: "Go back", style: "cancel" },
        { text: "It's different, save it", onPress: () => save(result) },
      ]
    );
  }

  return (
    <ScrollView style={{ backgroundColor: t.background }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={[styles.note, { backgroundColor: t.source.USER.soft, borderColor: t.source.USER.solid + "55" }]}>
        <Text style={[styles.noteText, { color: t.text }]}>
          Tournaments you add show under <Text style={{ fontWeight: "700" }}>Added by archers</Text> with your name, so everyone
          knows they aren't from an official schedule. They show to archers browsing that state.
        </Text>
      </View>
      <Field label="Tournament name" value={name} onChangeText={setName} placeholder="Wichita Falls Spring 3D Shoot" maxLength={120} autoCapitalize="words" />
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Field label="Start date" value={start} onChangeText={setStart} placeholder="MM/DD/YYYY" keyboardType="numbers-and-punctuation" maxLength={10} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="End date (optional)" value={end} onChangeText={setEnd} placeholder="MM/DD/YYYY" keyboardType="numbers-and-punctuation" maxLength={10} />
        </View>
      </View>
      <Field label="Where" value={location} onChangeText={setLocation} placeholder="Range or club name, address" maxLength={160} />
      <View style={styles.row}>
        <View style={{ flex: 3 }}>
          <Field label="Town" value={city} onChangeText={setCity} placeholder="Wichita Falls" maxLength={60} autoCapitalize="words" />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="State"
            value={stateCode}
            onChangeText={(v) => setStateCode(v.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 2))}
            placeholder="TX"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={2}
          />
        </View>
      </View>
      <Field label="Host club or contact (optional)" value={host} onChangeText={setHost} maxLength={120} autoCapitalize="words" />
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Field label="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={40} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Email (optional)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" maxLength={120} />
        </View>
      </View>
      <View style={{ gap: 6 }}>
        <Text style={[styles.label, { color: t.muted }]}>Flyer picture (optional)</Text>
        {flyer?.preview ? (
          <View style={[styles.flyerBox, { borderColor: t.border, backgroundColor: t.card }]}>
            <Image source={{ uri: flyer.preview }} style={styles.flyer} resizeMode="contain" accessibilityLabel="Tournament flyer" />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Button small kind="secondary" title="Replace" onPress={() => pickFlyer(false)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button small kind="danger" title="Remove" onPress={() => setFlyer(null)} />
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.row}>
            <Pressable onPress={() => pickFlyer(true)} style={[styles.pick, { borderColor: t.border, backgroundColor: t.card }]} accessibilityRole="button">
              <Text style={[styles.pickText, { color: t.primary }]}>📷  Take photo</Text>
            </Pressable>
            <Pressable onPress={() => pickFlyer(false)} style={[styles.pick, { borderColor: t.border, backgroundColor: t.card }]} accessibilityRole="button">
              <Text style={[styles.pickText, { color: t.primary }]}>🖼  Choose photo</Text>
            </Pressable>
          </View>
        )}
      </View>
      <Field label="Website or flyer link (optional)" value={url} onChangeText={setUrl} keyboardType="url" autoCapitalize="none" maxLength={300} placeholder="facebook.com/…" />
      <Field label="Details (optional)" value={details} onChangeText={setDetails} multiline maxLength={1500} placeholder="Classes, entry fees, start times, food…" />
      <Button title={submitLabel} onPress={submit} busy={busy} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, gap: 14, paddingBottom: 40 },
  row: { flexDirection: "row", gap: 10 },
  note: { borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, padding: 10 },
  noteText: { fontSize: 14, lineHeight: 19 },
  label: { fontSize: 13, fontWeight: "600" },
  flyerBox: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 10, gap: 10 },
  flyer: { width: "100%", height: 260, borderRadius: 8 },
  pick: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  pickText: { fontSize: 15, fontWeight: "700" },
});
