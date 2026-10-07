// Marketplace tab: browse used archery gear for local pickup near you.
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useGoing } from "../../src/features/calendar";
import { fetchListings, PAGE_SIZE } from "../../src/features/marketplace/api";
import { useInbox } from "../../src/features/marketplace/inbox";
import { ListingCard } from "../../src/features/marketplace/components/ListingCard";
import { useRequireMember } from "../../src/features/marketplace/helpers";
import { CATEGORIES, type Category, type Listing } from "../../src/features/marketplace/types";
import { useAuth } from "../../src/lib/auth";
import { approxHere, milesBetween, placeCoords, type Coords } from "../../src/lib/location";
import { marketplaceConfigured } from "../../src/lib/supabase";
import { Button, Chip, Empty, errorText, useTheme } from "../../src/ui";

// Pickup is local only, so the tab starts at 100 miles from the archer.
const DISTANCES = [25, 50, 100, 250] as const;
const DEFAULT_MILES = 100;

export default function MarketTab() {
  const t = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const requireMember = useRequireMember();
  const { blocked, profile } = useAuth();
  const { going, reload: reloadGoing } = useGoing();
  const { unreadCount } = useInbox();

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState(""); // search applied after a short pause
  const [category, setCategory] = useState<Category | null>(null);
  const [atMyShoots, setAtMyShoots] = useState(false);
  const [miles, setMiles] = useState<number | null>(DEFAULT_MILES); // null = any distance
  const [origin, setOrigin] = useState<Coords | null>(null);
  const [originChecked, setOriginChecked] = useState(false);
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
          <View style={styles.headerButtons}>
            <Pressable
              onPress={() => router.push("/messages")}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={unreadCount > 0 ? `Messages, ${unreadCount} unread` : "Messages"}
            >
              <Ionicons name="chatbubbles-outline" size={24} color={t.primary} />
              {unreadCount > 0 ? (
                <View style={[styles.badge, { backgroundColor: t.primary }]}>
                  <Text style={[styles.badgeText, { color: t.onPrimary }]}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
                </View>
              ) : null}
            </Pressable>
            <Pressable onPress={sell} hitSlop={10} accessibilityRole="button" accessibilityLabel="Sell gear">
              <Text style={{ color: t.primary, fontSize: 16, fontWeight: "700" }}>+ Sell</Text>
            </Pressable>
          </View>
        ) : null,
    });
  }, [navigation, sell, router, unreadCount, t.primary, t.onPrimary]);

  useEffect(() => {
    const id = setTimeout(() => setQuery(search), 350);
    return () => clearTimeout(id);
  }, [search]);

  // Where "near me" is: the phone's rough location, or else the city on their profile.
  useEffect(() => {
    if (!marketplaceConfigured) return;
    let cancelled = false;
    (async () => {
      const here = (await approxHere()) ?? (await placeCoords(profile?.city));
      if (cancelled) return;
      setOrigin(here);
      setOriginChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.city]);

  // Shoot hand-offs are already local to a tournament, so the distance filter steps aside.
  const near = !atMyShoots && miles && origin ? { at: origin, miles } : null;
  const nearKey = near ? `${near.at.lat},${near.at.lng},${near.miles}` : "";

  const eventIds = atMyShoots ? Array.from(going) : null;
  const eventKey = eventIds?.join(",") ?? "";

  const load = useCallback(
    async (nextPage: number) => {
      if (!marketplaceConfigured || !originChecked) return;
      const id = ++requestId.current;
      setLoading(true);
      try {
        const rows = await fetchListings({ search: query, category, eventIds, near, page: nextPage });
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
    [query, category, eventKey, nearKey, originChecked]
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

  const distanceTo = useCallback(
    (l: Listing) => (origin && l.lat != null && l.lng != null ? milesBetween(origin, { lat: l.lat, lng: l.lng }) : null),
    [origin]
  );

  // The database filters on a box around the archer; this trims it to a true circle.
  const visible = useMemo(
    () =>
      items.filter((l) => {
        if (blocked.has(l.seller_id)) return false;
        if (!near) return true;
        const d = distanceTo(l);
        return d != null && d <= near.miles;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, blocked, nearKey, distanceTo]
  );

  if (!marketplaceConfigured) {
    return (
      <View style={[styles.fill, { backgroundColor: t.background }]}>
        <Empty
          title="Marketplace coming soon"
          body="Buy and sell used bows, arrows, sights and more with archers near you, and hand gear off at an upcoming shoot."
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
      {!atMyShoots ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {DISTANCES.map((d) => (
            <Chip key={d} label={`Within ${d} mi`} active={!!origin && miles === d} onPress={() => setMiles(d)} />
          ))}
          <Chip label="Any distance" active={!origin || miles === null} onPress={() => setMiles(null)} />
        </ScrollView>
      ) : null}
      {originChecked && !origin && !atMyShoots ? (
        <Text style={[styles.hint, { color: t.muted }]}>
          Showing gear from everywhere. Turn on location, or add your city in Account, to see gear you can pick up nearby.
        </Text>
      ) : null}
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
          <ListingCard listing={item} miles={distanceTo(item)} onPress={(l) => router.push(`/listing/${l.id}`)} />
        </View>
      )}
      ListHeaderComponent={header}
      ListEmptyComponent={
        loading || !originChecked ? (
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
            title={query || category ? "No matches" : near ? `Nothing within ${near.miles} miles yet` : "No listings yet"}
            body={
              query || category
                ? "Try a different search or category."
                : near
                  ? "Try a bigger distance, or be the first to list gear near you."
                  : "Be the first to list some gear."
            }
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
  headerButtons: { flexDirection: "row", alignItems: "center", gap: 20, paddingHorizontal: 16 },
  badge: { position: "absolute", top: -6, right: -10, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: "center", justifyContent: "center" },
  badgeText: { fontSize: 11, fontWeight: "800" },
  list: { paddingHorizontal: 11, paddingBottom: 24 },
  row: { gap: 0 },
  cell: { flex: 1 / 2 },
  header: { paddingHorizontal: 5, paddingTop: 8, paddingBottom: 6, gap: 10 },
  search: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 10 },
  chips: { gap: 8, paddingRight: 8 },
  error: { fontSize: 13 },
  hint: { fontSize: 13, lineHeight: 18 },
});
