// Edit a tournament you added.
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";
import type { TournamentEvent } from "../../../src/features/calendar";
import { TournamentForm, fetchCommunityEvent, updateCommunityEvent, useCommunity } from "../../../src/features/community";
import { useAuth } from "../../../src/lib/auth";
import { Empty, useTheme } from "../../../src/ui";

export default function EditTournamentScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useAuth();
  const { refresh } = useCommunity();
  const [event, setEvent] = useState<TournamentEvent | null | undefined>(undefined);

  useEffect(() => {
    fetchCommunityEvent(id).then(setEvent).catch(() => setEvent(null));
  }, [id]);

  if (event === undefined) return <ActivityIndicator color={t.primary} style={{ marginTop: 40 }} />;
  if (!event || event.addedById !== userId) return <Empty title="Can't edit this one" body="You can only edit tournaments you added." />;

  return (
    <TournamentForm
      initial={event}
      submitLabel="Save changes"
      onSubmit={async (input) => {
        await updateCommunityEvent(id, input);
        await refresh();
        router.back();
      }}
    />
  );
}
