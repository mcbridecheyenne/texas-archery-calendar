import { useState } from "react";
import { Image, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { photoUrl } from "../../../lib/supabase";
import { useTheme } from "../../../ui";

// Swipeable photos with a "2 / 5" counter.
export function PhotoCarousel({ photos }: { photos: string[] }) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);

  if (!photos.length) return <View style={{ width, height: width * 0.75, backgroundColor: t.subtle }} />;

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
      >
        {photos.map((p) => (
          <Image key={p} source={{ uri: photoUrl(p) }} style={{ width, height: width, backgroundColor: t.subtle }} resizeMode="cover" />
        ))}
      </ScrollView>
      {photos.length > 1 ? (
        <View style={styles.counter}>
          <Text style={styles.counterText}>
            {index + 1} / {photos.length}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  counter: { position: "absolute", right: 12, bottom: 12, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  counterText: { color: "#fff", fontSize: 12, fontWeight: "700" },
});
