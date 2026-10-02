import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";
import { fetchListing, saveListing } from "../../../src/features/marketplace/api";
import { ListingForm } from "../../../src/features/marketplace/components/ListingForm";
import type { Listing } from "../../../src/features/marketplace/types";
import { useAuth } from "../../../src/lib/auth";
import { Empty, useTheme } from "../../../src/ui";

export default function EditListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useTheme();
  const { userId } = useAuth();
  const [listing, setListing] = useState<Listing | null | undefined>(undefined);

  useEffect(() => {
    fetchListing(id).then(setListing).catch(() => setListing(null));
  }, [id]);

  if (listing === undefined) return <ActivityIndicator color={t.primary} style={{ marginTop: 60 }} />;
  if (!listing || listing.seller_id !== userId) return <Empty title="You can only edit your own listings." />;

  return (
    <ListingForm
      initial={listing}
      submitLabel="Save changes"
      onSubmit={async (input) => {
        await saveListing(userId!, input, listing);
        router.back();
      }}
    />
  );
}
