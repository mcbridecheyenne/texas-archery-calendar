// Add a tournament that isn't on the TFAA, Texas ASA or TSAA schedules.
import { useRouter } from "expo-router";
import { Alert } from "react-native";
import { TournamentForm, createCommunityEvent, useCommunity } from "../../src/features/community";
import { useAuth } from "../../src/lib/auth";
import { Button, Empty } from "../../src/ui";

export default function NewTournamentScreen() {
  const router = useRouter();
  const { userId, profile, enabled } = useAuth();
  const { refresh } = useCommunity();

  if (!enabled) return <Empty title="Coming soon" body="Adding tournaments opens with accounts." />;
  if (!userId)
    return (
      <Empty
        title="Sign in to add a tournament"
        body="Your name shows on tournaments you add, so archers know who posted them."
        action={<Button title="Sign in" onPress={() => router.push("/sign-in")} />}
      />
    );
  if (!profile)
    return <Empty title="Finish your profile" action={<Button title="Set up profile" onPress={() => router.push("/setup-profile")} />} />;

  return (
    <TournamentForm
      submitLabel="Add tournament"
      onSubmit={async (input) => {
        await createCommunityEvent(userId, input);
        await refresh();
        router.back();
        Alert.alert("Tournament added", "It's on the calendar under Added by archers.");
      }}
    />
  );
}
