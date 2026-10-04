// Form for posting or editing a listing: photos, details, price, and an
// optional tournament to hand the gear off at.
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { API_BASE_URL, RULES_URL } from "../../../../config";
import { useEvents, useGoing, type TournamentEvent } from "../../calendar";
import { fmtRange, toIso } from "../../calendar/dates";
import { sourceLabel } from "../../calendar/types";
import { photoUrl } from "../../../lib/supabase";
import { Button, Chip, Field, SectionLabel, errorText, showMenu, useTheme } from "../../../ui";
import type { ListingInput, PhotoItem } from "../api";
import { checkListingText } from "../moderation";
import { CATEGORIES, CONDITIONS, type Category, type Condition, type Listing } from "../types";

const MAX_PHOTOS = 6;

export function ListingForm({
  initial,
  defaultCity,
  submitLabel,
  onSubmit,
}: {
  initial?: Listing;
  defaultCity?: string | null;
  submitLabel: string;
  onSubmit: (input: ListingInput) => Promise<void>;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [photos, setPhotos] = useState<PhotoItem[]>(initial?.photos.map((path) => ({ path })) ?? []);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [price, setPrice] = useState(initial ? String(initial.price_cents / 100) : "");
  const [category, setCategory] = useState<Category | null>(initial?.category ?? null);
  const [condition, setCondition] = useState<Condition | null>(initial?.condition ?? null);
  const [city, setCity] = useState(initial?.city ?? defaultCity ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [handoff, setHandoff] = useState<ListingInput["handoff"]>(
    initial?.handoff_event_id && initial.handoff_event_name
      ? { id: initial.handoff_event_id, name: initial.handoff_event_name, date: initial.handoff_event_date ?? "" }
      : null
  );
  const [pickingShoot, setPickingShoot] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function addPhotos(fromCamera: boolean) {
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) return;
    try {
      let result: ImagePicker.ImagePickerResult;
      if (fromCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Camera access is off", "Allow camera access in Settings to take photos of your gear.", [
            { text: "Not now", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ]);
          return;
        }
        result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsMultipleSelection: true,
          selectionLimit: room,
          quality: 1,
        });
      }
      if (result.canceled) return;
      const picked = result.assets.slice(0, room).map((a) => ({ uri: a.uri, width: a.width, height: a.height }));
      setPhotos((cur) => [...cur, ...picked]);
      setErrors((e) => ({ ...e, photos: "" }));
    } catch (e) {
      Alert.alert("Couldn't add photos", errorText(e));
    }
  }

  function photoMenu(index: number) {
    showMenu("Photo", [
      ...(index > 0
        ? [{ label: "Make cover photo", onPress: () => setPhotos((cur) => [cur[index], ...cur.filter((_, i) => i !== index)]) }]
        : []),
      { label: "Remove photo", destructive: true, onPress: () => setPhotos((cur) => cur.filter((_, i) => i !== index)) },
    ]);
  }

  async function submit() {
    const e: Record<string, string> = {};
    const cents = Math.round(parseFloat(price.replace(/[$,\s]/g, "")) * 100);
    if (!photos.length) e.photos = "Add at least one photo.";
    if (title.trim().length < 3) e.title = "Give it a short title (at least 3 letters).";
    if (!Number.isFinite(cents) || cents < 0) e.price = "Enter a price, or 0 for free.";
    else if (cents > 2000000) e.price = "Price must be under $20,000.";
    if (!category) e.category = "Pick a category.";
    if (!condition) e.condition = "Pick a condition.";
    const blocked = checkListingText(title, description);
    if (blocked) e.title = blocked;
    setErrors(e);
    if (Object.values(e).some(Boolean)) {
      Alert.alert("Almost there", Object.values(e).filter(Boolean)[0]);
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        title,
        description,
        priceCents: cents,
        category: category!,
        condition: condition!,
        city,
        handoff,
        photos,
      });
    } catch (err) {
      Alert.alert("Couldn't save your listing", errorText(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={64}>
      <ScrollView
        style={{ backgroundColor: t.background }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <SectionLabel>{`Photos (${photos.length}/${MAX_PHOTOS})`}</SectionLabel>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
          {photos.map((p, i) => (
            <Pressable key={p.path ?? p.uri} onPress={() => photoMenu(i)} accessibilityRole="button" accessibilityLabel={`Photo ${i + 1}`}>
              <Image source={{ uri: p.uri ?? photoUrl(p.path!) }} style={[styles.thumb, { backgroundColor: t.subtle }]} />
              {i === 0 ? (
                <View style={[styles.cover, { backgroundColor: t.primary }]}>
                  <Text style={{ color: t.onPrimary, fontSize: 10, fontWeight: "800" }}>COVER</Text>
                </View>
              ) : null}
            </Pressable>
          ))}
          {photos.length < MAX_PHOTOS ? (
            <>
              <AddTile icon="images-outline" label="Library" onPress={() => addPhotos(false)} />
              <AddTile icon="camera-outline" label="Camera" onPress={() => addPhotos(true)} />
            </>
          ) : null}
        </ScrollView>
        {errors.photos ? <Text style={[styles.err, { color: t.danger }]}>{errors.photos}</Text> : null}

        <View style={styles.fields}>
          <Field
            label="Title"
            value={title}
            onChangeText={setTitle}
            placeholder="Mathews V3X 29, 70 lb, RH"
            maxLength={80}
            error={errors.title}
          />
          <Field
            label="Price"
            value={price}
            onChangeText={setPrice}
            placeholder="$0 for free"
            keyboardType="decimal-pad"
            error={errors.price}
          />
        </View>

        <SectionLabel>Category</SectionLabel>
        <View style={styles.wrap}>
          {CATEGORIES.map((c) => (
            <Chip key={c.id} label={c.label} active={category === c.id} onPress={() => setCategory(c.id)} />
          ))}
        </View>
        {errors.category ? <Text style={[styles.err, { color: t.danger }]}>{errors.category}</Text> : null}

        <SectionLabel>Condition</SectionLabel>
        <View style={styles.wrap}>
          {CONDITIONS.map((c) => (
            <Chip key={c.id} label={c.label} active={condition === c.id} onPress={() => setCondition(c.id)} />
          ))}
        </View>
        {errors.condition ? <Text style={[styles.err, { color: t.danger }]}>{errors.condition}</Text> : null}

        <View style={styles.fields}>
          <Field
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="Draw length, poundage, hand, what's included, any wear…"
            multiline
            maxLength={2000}
          />
          <Field
            label="Pickup city"
            value={city}
            onChangeText={setCity}
            placeholder="e.g. Wichita Falls, TX"
            maxLength={60}
            hint="Local pickup only, no shipping. Archers nearby find your gear by this city."
          />
        </View>

        <SectionLabel>Hand off at a shoot (optional)</SectionLabel>
        <Pressable
          onPress={() => setPickingShoot(true)}
          style={[styles.shoot, { backgroundColor: t.card, borderColor: t.border }]}
          accessibilityRole="button"
        >
          <Text style={[styles.shootText, { color: handoff ? t.text : t.muted }]} numberOfLines={2}>
            {handoff ? `🤝 ${handoff.name}${handoff.date ? ` · ${fmtRange(handoff.date, handoff.date)}` : ""}` : "Pick a tournament you'll be at"}
          </Text>
          {handoff ? (
            <Pressable onPress={() => setHandoff(null)} hitSlop={10} accessibilityLabel="Clear tournament">
              <Ionicons name="close-circle" size={20} color={t.muted} />
            </Pressable>
          ) : (
            <Ionicons name="chevron-forward" size={18} color={t.muted} />
          )}
        </Pressable>

        <View style={{ marginTop: 24 }}>
          <Button title={submitLabel} onPress={submit} busy={saving} />
        </View>
        <Pressable onPress={() => Linking.openURL(RULES_URL)} style={{ marginTop: 12 }} accessibilityRole="link">
          <Text style={[styles.rules, { color: t.muted }]}>
            By posting you agree to the <Text style={{ color: t.primary }}>marketplace rules</Text>. Archery gear only.
          </Text>
        </Pressable>
      </ScrollView>

      <ShootPicker
        visible={pickingShoot}
        onClose={() => setPickingShoot(false)}
        onPick={(ev) => {
          setHandoff({ id: ev.id, name: ev.name, date: ev.startDate });
          setPickingShoot(false);
        }}
      />
    </KeyboardAvoidingView>
  );
}

function AddTile({ icon, label, onPress }: { icon: "images-outline" | "camera-outline"; label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.thumb, styles.add, { borderColor: t.border, backgroundColor: t.card }]}
      accessibilityRole="button"
      accessibilityLabel={`Add photo from ${label}`}
    >
      <Ionicons name={icon} size={26} color={t.primary} />
      <Text style={{ color: t.muted, fontSize: 12, marginTop: 4 }}>{label}</Text>
    </Pressable>
  );
}

// Upcoming tournaments, with the ones the person starred first.
function ShootPicker({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (e: TournamentEvent) => void }) {
  const t = useTheme();
  const { data, loading } = useEvents(API_BASE_URL);
  const { going } = useGoing();
  const today = toIso(new Date());
  const events = useMemo(() => {
    const upcoming = (data?.events ?? []).filter((e) => e.endDate >= today);
    return [...upcoming.filter((e) => going.has(e.id)), ...upcoming.filter((e) => !going.has(e.id))].slice(0, 80);
  }, [data, going, today]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: t.background }}>
        <View style={[styles.pickerTop, { borderBottomColor: t.border }]}>
          <Text style={[styles.pickerTitle, { color: t.text }]}>Pick a tournament</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={{ color: t.primary, fontSize: 16, fontWeight: "600" }}>Cancel</Text>
          </Pressable>
        </View>
        {loading && !data ? (
          <ActivityIndicator color={t.primary} style={{ marginTop: 40 }} />
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
            {events.map((e) => (
              <Pressable
                key={e.id}
                onPress={() => onPick(e)}
                style={({ pressed }) => [styles.pickRow, { backgroundColor: t.card, borderColor: t.border, opacity: pressed ? 0.75 : 1 }]}
              >
                <Text style={[styles.pickName, { color: t.text }]}>
                  {going.has(e.id) ? "★ " : ""}
                  {e.name}
                </Text>
                <Text style={{ color: t.muted, fontSize: 13 }}>
                  {fmtRange(e.startDate, e.endDate)} · {sourceLabel(e.source)}
                  {e.city ? ` · ${e.city}` : ""}
                </Text>
              </Pressable>
            ))}
            {!events.length ? <Text style={{ color: t.muted, textAlign: "center", marginTop: 30 }}>No upcoming tournaments found.</Text> : null}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16 },
  photos: { gap: 10, paddingVertical: 2 },
  thumb: { width: 96, height: 96, borderRadius: 12 },
  add: { borderWidth: 1.5, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  cover: { position: "absolute", left: 6, bottom: 6, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  fields: { gap: 14, marginTop: 18 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  err: { fontSize: 12, marginTop: 6 },
  shoot: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 13 },
  shootText: { flex: 1, fontSize: 15 },
  rules: { fontSize: 12, textAlign: "center", lineHeight: 17 },
  pickerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  pickerTitle: { fontSize: 18, fontWeight: "700" },
  pickRow: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 3 },
  pickName: { fontSize: 15, fontWeight: "600" },
});
