// Small shared UI pieces so every tab looks like it belongs to the same app.
// Colors come from the calendar's theme (parchment, burnt orange, pine).
import { forwardRef, type ReactNode } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { useCalendarTheme, type CalendarTheme } from "../features/calendar";

export const useTheme = useCalendarTheme;
export type Theme = CalendarTheme;

export function Button({
  title,
  onPress,
  kind = "primary",
  busy,
  disabled,
  small,
}: {
  title: string;
  onPress: () => void;
  kind?: "primary" | "secondary" | "danger";
  busy?: boolean;
  disabled?: boolean;
  small?: boolean;
}) {
  const t = useTheme();
  const bg = kind === "primary" ? t.primary : kind === "danger" ? "transparent" : t.card;
  const fg = kind === "primary" ? t.onPrimary : kind === "danger" ? t.danger : t.text;
  const border = kind === "primary" ? t.primary : kind === "danger" ? t.danger : t.border;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || busy) }}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[styles.btnText, small && { fontSize: 14 }, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export const Field = forwardRef<TextInput, TextInputProps & { label: string; hint?: string; error?: string | null }>(
  function Field({ label, hint, error, style, ...rest }, ref) {
    const t = useTheme();
    return (
      <View style={styles.field}>
        <Text style={[styles.label, { color: t.muted }]}>{label}</Text>
        <TextInput
          ref={ref}
          placeholderTextColor={t.muted + "99"}
          style={[
            styles.input,
            { color: t.text, backgroundColor: t.card, borderColor: error ? t.danger : t.border },
            rest.multiline && { minHeight: 110, textAlignVertical: "top", paddingTop: 12 },
            style,
          ]}
          {...rest}
        />
        {error ? <Text style={[styles.hint, { color: t.danger }]}>{error}</Text> : hint ? <Text style={[styles.hint, { color: t.muted }]}>{hint}</Text> : null}
      </View>
    );
  }
);

export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[
        styles.chip,
        active ? { backgroundColor: t.text, borderColor: t.text } : { backgroundColor: t.card, borderColor: t.border },
      ]}
    >
      <Text style={[styles.chipText, { color: active ? t.background : t.text }]}>{label}</Text>
    </Pressable>
  );
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={styles.empty}>
      <Text style={[styles.emptyTitle, { color: t.text }]}>{title}</Text>
      {body ? <Text style={[styles.emptyBody, { color: t.muted }]}>{body}</Text> : null}
      {action ? <View style={{ marginTop: 14, alignSelf: "stretch" }}>{action}</View> : null}
    </View>
  );
}

export function SectionLabel({ children }: { children: string }) {
  const t = useTheme();
  return <Text style={[styles.section, { color: t.muted }]}>{children.toUpperCase()}</Text>;
}

export interface MenuOption {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

// Native-looking choice menu: action sheet on iPhone, dialog on Android.
export function showMenu(title: string, options: MenuOption[]) {
  if (Platform.OS === "ios") {
    const destructiveButtonIndex = options.map((o, i) => (o.destructive ? i : -1)).filter((i) => i >= 0);
    ActionSheetIOS.showActionSheetWithOptions(
      { title, options: [...options.map((o) => o.label), "Cancel"], cancelButtonIndex: options.length, destructiveButtonIndex },
      (i) => {
        if (i < options.length) options[i].onPress();
      }
    );
  } else {
    Alert.alert(title, undefined, [
      ...options.map((o) => ({ text: o.label, onPress: o.onPress, style: o.destructive ? ("destructive" as const) : ("default" as const) })),
      { text: "Cancel", style: "cancel" as const },
    ]);
  }
}

export function confirm(title: string, message: string, action: string, onConfirm: () => void) {
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: action, style: "destructive", onPress: onConfirm },
  ]);
}

export function errorText(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? String(e);
  if (/network|fetch/i.test(msg)) return "Couldn't connect. Check your signal and try again.";
  return msg;
}

const styles = StyleSheet.create({
  btn: { borderRadius: 12, borderWidth: 1.5, paddingVertical: 13, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", minHeight: 50 },
  btnSmall: { paddingVertical: 8, paddingHorizontal: 14, minHeight: 38, borderRadius: 10 },
  btnText: { fontSize: 16, fontWeight: "700" },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: "600" },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16 },
  hint: { fontSize: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  chipText: { fontSize: 13, fontWeight: "600" },
  empty: { alignItems: "center", paddingVertical: 48, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  emptyBody: { fontSize: 14, textAlign: "center", marginTop: 6, lineHeight: 20 },
  section: { fontSize: 12, fontWeight: "700", letterSpacing: 1.2, marginTop: 20, marginBottom: 8 },
});
