import { useRouter } from "expo-router";
import { saveListing } from "../../src/features/marketplace/api";
import { ListingForm } from "../../src/features/marketplace/components/ListingForm";
import { useAuth } from "../../src/lib/auth";
import { Empty } from "../../src/ui";

export default function NewListingScreen() {
  const router = useRouter();
  const { userId, profile } = useAuth();
  if (!userId || !profile) return <Empty title="Sign in to sell gear" />;
  return (
    <ListingForm
      defaultCity={profile.city}
      submitLabel="Post listing"
      onSubmit={async (input) => {
        const id = await saveListing(userId, input);
        router.replace(`/listing/${id}`);
      }}
    />
  );
}
