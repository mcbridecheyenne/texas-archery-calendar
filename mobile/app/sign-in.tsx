// Sign in with Apple (iPhone) or a 6-digit code sent by email (everyone).
import * as AppleAuthentication from "expo-apple-authentication";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { EMAIL_SIGN_IN_ENABLED, PRIVACY_URL, RULES_URL } from "../config";
import { isMarkedUnder13 } from "../src/lib/age";
import { useAuth } from "../src/lib/auth";
import { Button, Field, errorText, useTheme } from "../src/ui";

export default function SignInScreen() {
  const t = useTheme();
  const router = useRouter();
  const { appleAvailable, signInWithApple, sendEmailCode, verifyEmailCode, session, profile, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  // Someone who said they're under 13 on this phone sees the "13 and older" note instead.
  useEffect(() => {
    isMarkedUnder13().then((v) => {
      if (v) router.replace("/setup-profile");
    });
  }, [router]);

  // Once signed in and the profile has loaded: new people set up a profile, others go back.
  useEffect(() => {
    if (!signedIn || !session || loading) return;
    if (profile) router.back();
    else router.replace("/setup-profile");
  }, [signedIn, session, profile, loading, router]);

  async function apple() {
    try {
      setBusy(true);
      if ((await signInWithApple()) === "ok") setSignedIn(true);
    } catch (e) {
      Alert.alert("Couldn't sign in with Apple", errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function sendCode() {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      Alert.alert("Check your email", "That doesn't look like an email address.");
      return;
    }
    try {
      setBusy(true);
      await sendEmailCode(email);
      setStep("code");
    } catch (e) {
      Alert.alert("Couldn't send the code", errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    try {
      setBusy(true);
      await verifyEmailCode(email, code);
      setSignedIn(true);
    } catch (e) {
      Alert.alert("That code didn't work", "Check the newest email and try again, or send a new code.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: t.text }]}>Sign in</Text>
        <Text style={[styles.lead, { color: t.muted }]}>
          An account lets you add friends, share the shoots you're going to, add tournaments, and buy or sell gear. Browsing the schedule never needs one.
        </Text>

        {appleAvailable && step === "email" ? (
          <>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={t.dark ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={12}
              style={styles.apple}
              onPress={apple}
            />
            {EMAIL_SIGN_IN_ENABLED ? (
              <View style={styles.orRow}>
                <View style={[styles.line, { backgroundColor: t.border }]} />
                <Text style={{ color: t.muted, fontSize: 13 }}>or use email</Text>
                <View style={[styles.line, { backgroundColor: t.border }]} />
              </View>
            ) : null}
          </>
        ) : null}

        {!EMAIL_SIGN_IN_ENABLED ? (
          appleAvailable ? null : (
            <Text style={[styles.lead, { color: t.text }]}>
              Sign-in on this phone is coming soon. You can still browse every tournament and the marketplace.
            </Text>
          )
        ) : step === "email" ? (
          <View style={styles.form}>
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="send"
              onSubmitEditing={sendCode}
            />
            <Button title="Email me a code" onPress={sendCode} busy={busy} kind={appleAvailable ? "secondary" : "primary"} />
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={{ color: t.text, fontSize: 15 }}>
              We sent a 6-digit code to <Text style={{ fontWeight: "700" }}>{email.trim()}</Text>.
            </Text>
            <Field
              label="Code"
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              autoFocus
              style={{ fontSize: 22, letterSpacing: 6 }}
            />
            <Button title="Sign in" onPress={verify} busy={busy} disabled={code.length < 6} />
            <Pressable onPress={() => setStep("email")} hitSlop={8}>
              <Text style={[styles.link, { color: t.primary }]}>Use a different email or resend</Text>
            </Pressable>
          </View>
        )}

        <Text style={[styles.fine, { color: t.muted }]}>
          By continuing you agree to the{" "}
          <Text style={{ color: t.primary }} onPress={() => Linking.openURL(RULES_URL)}>
            marketplace rules
          </Text>{" "}
          and{" "}
          <Text style={{ color: t.primary }} onPress={() => Linking.openURL(PRIVACY_URL)}>
            privacy policy
          </Text>
          .
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 22, gap: 14 },
  title: { fontSize: 28, fontWeight: "800" },
  lead: { fontSize: 15, lineHeight: 21 },
  apple: { height: 50, marginTop: 10 },
  orRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 4 },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  form: { gap: 14 },
  link: { textAlign: "center", fontSize: 14, fontWeight: "600" },
  fine: { fontSize: 12, lineHeight: 17, textAlign: "center", marginTop: 8 },
});
