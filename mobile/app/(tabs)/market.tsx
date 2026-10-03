// Marketplace tab: browse used archery gear from Texas archers.
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useGoing } from "../../src/features/calendar";
import { fetchListings, PAGE_SIZE } from "../../src/features/marketplace/api";
import { ListingCard } from "../../src/features/marketplace/components/ListingCard";
import { useRequireMember } from "../../src/features/marketplace/helpers";
import { CATEGORIES, type Category, type Listing } from "../../src/features/marketplace/types";
import { useAuth } from "../../src/lib/auth";
import { marketplaceConfigured } from "../../src/lib/supabase";
import { Button, Chip, Empty, errorText, useTheme } from "../../src/ui";

export default function MarketTab() {
  const t = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const requireMember = useRequireMember();
  const { blocked } = useAuth();
  const { going, reload: reloadGoing } = useGoing();

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState(""); // search applied after a short pause
  const [category, setCategory] = useState<Category | null>(null);
  const [atMyShoots, setAtMyShoots] = useState(false);
  const [items, setItems] = useState<Listing[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const sell = useCallback(() => {
    if (requireMember()) router.push("/listing/new");
  }, [requireMember, router]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        marketplaceConfigured ? (
          <Pressable onPress={sell} hitSlop={10} style={{ paddingHorizontal: 16 }} accessibilityRole="button" accessibilityLabel="Sell gear">
            <Text style={{ color: t.primary, fontSize: 16, fontWeight: "700" }}>+ Sell</Text>
          </Pressable>
        ) : null,
    });
  }, [navigation, sell, t.primary]);

  useEffect(() => {
    const id = setTimeout(() => setQuery(search), 350);
    return () => clearTimeout(id);
  }, [search]);

  const eventIds = atMyShoots ? Array.from(going) : null;
  const eventKey = eventIds?.join(",") ?? "";

  const load = useCallback(
    async (nextPage: number) => {
      if (!marketplaceConfigured) return;
      const id = ++requestId.current;
      setLoading(true);
      try {
        const rows = await fetchListings({ search: query, category, eventIds, page: nextPage });
        if (id !== requestId.current) return; // a newer search started
        setItems((cur) => (nextPage === 0 ? rows : [...cur, ...rows.filter((r) => !cur.some((c) => c.id === r.id))]));
        setHasMore(rows.length === PAGE_SIZE);
        setPage(nextPage);
        setError(null);
      } catch (e) {
        if (id === requestId.current) setError(errorText(e));
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, category, eventKey]
  );

  useEffect(() => {
    load(0);
  }, [load]);

  // Coming back to this tab (or back from a listing that was deleted, sold or edited):
  // reload the listings and the Going list so nothing stale stays on screen.
  const focusedBefore = useRef(false);
  useFocusEffect(
    useCallback(() => {
      reloadGoing();
      if (focusedBefore.current) load(0); // the first visit is already loaded by the effect above
      focusedBefore.current = true;
    }, [reloadGoing, load])
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load(0);
    setRefreshing(false);
  }, [load]);

  const visible = useMemo(() => items.filter((l) => !blocked.has(l.seller_id)), [items, blocked]);

  if (!marketplaceConfigured) {
    return (
      <View style={[styles.fill, { backgroundColor: t.background }]}>
        <Empty
          title="Marketplace coming soon"
          body="Buy and sell used bows, arrows, sights and more with archers across Texas, and hand gear off at an upcoming shoot."
        />
      </View>
    );
  }

  const header = (
    <View style={styles.header}>
      <View style={[styles.search, { backgroundColor: t.card, borderColor: t.border }]}>
        <Ionicons name="search" size={18} color={t.muted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search bows, sights, releases…"
          placeholderTextColor={t.muted}
          style={[styles.searchInput, { color: t.text }]}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCorrect={false}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label="All" active={!category && !atMyShoots} onPress={() => { setCategory(null); setAtMyShoots(false); }} />
        <Chip label="★ At my shoots" active={atMyShoots} onPress={() => setAtMyShoots((v) => !v)} />
        {CATEGORIES.map((c) => (
          <Chip key={c.id} label={c.label} active={category === c.id} onPress={() => setCategory(category === c.id ? null : c.id)} />
        ))}
      </ScrollView>
      {error ? <Text style={[styles.error, { color: t.danger }]}>{error}</Text> : null}
    </View>
  );

  return (
    <FlatList
      style={{ backgroundColor: t.background }}
      data={visible}
      keyExtractor={(l) => l.id}
      numColumns={2}
      contentContainerStyle={styles.list}
      columnWrapperStyle={styles.row}
      renderItem={({ item }) => (
        <View style={styles.cell}>
          <ListingCard listing={item} onPress={(l) => router.push(`/listing/${l.id}`)} />
        </View>
      )}
      ListHeaderComponent={header}
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator color={t.primary} style={{ marginTop: 40 }} />
        ) : atMyShoots ? (
          <Empty
            title={going.size ? "Nothing for your shoots yet" : "No shoots starred"}
            body={
              going.size
                ? "No one has listed gear to hand off at the tournaments you're going to."
                : "Star tournaments on the Tournaments tab to see gear people will bring to them."
            }
          />
        ) : (
          <Empty
            title={query || category ? "No matches" : "No listings yet"}
            body={query || category ? "Try a different search or category." : "Be the first to list some gear."}
            action={<Button title="Sell gear" onPress={sell} />}
          />
        )
      }
      ListFooterComponent={loading && visible.length ? <ActivityIndicator color={t.primary} style={{ margin: 20 }} /> : null}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (hasMore && !loading && visible.length) load(page + 1);
      }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={t.primary} colors={[t.primary]} />}
      keyboardDismissMode="on-drag"
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  list: { paddingHorizontal: 11, paddingBottom: 24 },
  row: { gap: 0 },
  cell: { flex: 1 / 2 },
  header: { paddingHorizontal: 5, paddingTop: 8, paddingBottom: 6, gap: 10 },
  search: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 10 },
  chips: { gap: 8, paddingRight: 8 },
  error: { fontSize: 13 },
});
