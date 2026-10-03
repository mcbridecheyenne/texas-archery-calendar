// Opened from an invite link (archeryintexas://add-friend/CODE): sends the friend request.
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator } from "react-native";
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
  const sent = useRef(false);

  useEffect(() => {
    if (!fr.active || sent.current || !code) return;
    sent.current = true;
    fr.addByCode(cleanCode(code))
      .then((r) => setResult(addResultMessage(r)))
      .catch((e) => setResult(["Couldn't add friend", errorText(e)]));
  }, [fr.active, fr.addByCode, code]);

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
  if (!result) return <ActivityIndicator color={t.primary} style={{ marginTop: 40 }} />;
  return <Empty title={result[0]} body={result[1]} action={done} />;
}
