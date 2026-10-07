// In an archer-added tournament's detail sheet: Edit/Delete for whoever added it,
// Report (and Block the person who added it) for everyone else.
import { useRouter } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../lib/auth";
import { confirm, errorText, useTheme } from "../../ui";
import type { TournamentEvent } from "../calendar";
import { askAboutPerson, askToReport } from "../marketplace/helpers";
import { communityId, deleteCommunityEvent } from "./api";
import { useCommunity } from "./CommunityProvider";

export function CommunityActions({ event, close }: { event: TournamentEvent; close: () => void }) {
  const t = useTheme();
  const router = useRouter();
  const { userId, block } = useAuth();
  const { refresh } = useCommunity();
  const id = communityId(event);
  const mine = !!userId && event.addedById === userId;

  function edit() {
    close();
    setTimeout(() => router.push(`/tournament/edit/${id}`), 350);
  }

  function remove() {
    confirm("Delete this tournament?", "It will be removed for everyone, including anyone who marked it Going.", "Delete", async () => {
      try {
        await deleteCommunityEvent(id, event.flyerPath);
        close();
        await refresh();
      } catch (e) {
        Alert.alert("Couldn't delete it", errorText(e));
      }
    });
  }

  return (
    <View style={styles.row}>
      {mine ? (
        <>
          <Link label="Edit" color={t.primary} onPress={edit} />
          <Link label="Delete" color={t.danger} onPress={remove} />
        </>
      ) : (
        <>
          <Link
            label="Report this tournament"
            color={t.muted}
            onPress={() => askToReport(userId, { communityEventId: id, userId: event.addedById ?? undefined })}
          />
          {userId && event.addedById ? (
            <Link
              label={`Block ${event.addedBy ?? "this archer"}`}
              color={t.muted}
              onPress={() =>
                askAboutPerson(event.addedBy ?? "this archer", event.addedById!, userId, async (who) => {
                  await block(who);
                  close();
                })
              }
            />
          ) : null}
        </>
      )}
    </View>
  );
}

function Link({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button">
      <Text style={[styles.link, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 22, marginTop: 12, justifyContent: "center" },
  link: { fontSize: 14, fontWeight: "700" },
});
