// Opened from an invite link (archeryintexas://add-friend/CODE): shows the code and sends the friend request only when the archer taps the button.
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { addResultMessage, cleanCode, useFriends } from "../../src/features/friends";
import { useAuth } from "../../src/lib/auth";
import { Button, Empty, errorText, useTheme } from "../../src/ui";

export default function AddFriendLink() {
  const t = useTheme();
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const auth = useAuth();
  const fr = useFriends();
  const [result, setResult] = useState<[string, string] | null>(null);
  const [sending, setSending] = useState(false);

  function send() {
    if (!fr.active || sending || !code) return;
    setSending(true);
    fr.addByCode(cleanCode(code))
      .then((r) => setResult(addResultMessage(r)))
      .catch((e) => setResult(["Couldn't add friend", errorText(e)]))
      .finally(() => setSending(false));
  }

  const done = <Button title="See friends" onPress={() => router.replace("/friends")} />;

  if (!auth.enabled) return <Empty title="Friends are coming soon" />;
  if (auth.loading) return <ActivityIndicator color={t.primary} style={{ marginTop: 40 }} />;
  if (!auth.userId)
    return (
      <Empty
        title="Sign in to add your friend"
        body="Once you're signed in, come back to this link or enter their code on the Friends screen."
        action={<Button title="Sign in" onPress={() => router.push("/sign-in")} />}
      />
    );
  if (!auth.profile)
    return <Empty title="Finish your profile first" action={<Button title="Set up profile" onPress={() => router.push("/setup-profile")} />} />;
  if (!result)
    return (
      <Empty
        title="Add this archer as a friend?"
        body={`Friend code: ${cleanCode(code ?? "")}`}
        action={
          <View style={{ gap: 10 }}>
            <Button title="Send friend request" onPress={send} busy={sending || !fr.active} />
            <Button title="Cancel" kind="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
          </View>
        }
      />
    );
  return <Empty title={result[0]} body={result[1]} action={done} />;
}
