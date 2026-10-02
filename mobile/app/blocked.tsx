// People the signed-in person has blocked, with Unblock.
import { useEffect, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../src/lib/auth";
import { db } from "../src/lib/supabase";
import { Button, Empty, errorText, useTheme } from "../src/ui";

export default function BlockedScreen() {
  const t = useTheme();
  const { blocked, unblock } = useAuth();
  const [names, setNames] = useState<Record<string, string>>({});
  const ids = Array.from(blocked);

  useEffect(() => {
    if (!ids.length) return;
    db()
      .from("profiles")
      .select("id, display_name")
      .in("id", ids)
      .then(({ data }) => {
        const map: Record<string, string> = {};
        for (const p of (data ?? []) as { id: string; display_name: string }[]) map[p.id] = p.display_name;
        setNames(map);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(",")]);

  return (
    <FlatList
      style={{ backgroundColor: t.background }}
      data={ids}
      keyExtractor={(id) => id}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      renderItem={({ item }) => (
        <View style={[styles.row, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={[styles.name, { color: t.text }]}>{names[item] ?? "Archer"}</Text>
          <Button
            small
            kind="secondary"
            title="Unblock"
            onPress={() => unblock(item).catch((e) => Alert.alert("Couldn't unblock", errorText(e)))}
          />
        </View>
      )}
      ListEmptyComponent={<Empty title="No one blocked" body="People you block can't message you, and their listings are hidden." />}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  name: { flex: 1, fontSize: 16, fontWeight: "600" },
});
