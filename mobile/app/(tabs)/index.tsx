import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert } from "react-native";
import { ADS, API_BASE_URL, FLIGHTS, HOTELS, SHARE_PLUG } from "../../config";
import { CalendarScreen, StatePicker, useCalendarTheme, type CalendarSocial, type TournamentEvent } from "../../src/features/calendar";
import { CommunityActions, useCommunity } from "../../src/features/community";
import { FeatureButton, FeatureSheet, countOpened, countSeen, useFeatured, useShowFeatured } from "../../src/features/featured";
import { GoingWith, askShareLevel, useFriends } from "../../src/features/friends";
import { useAuth } from "../../src/lib/auth";
import { useHomeState } from "../../src/lib/homeState";
import { ListAd } from "../../src/monetization/ListAd";
import { usePremium } from "../../src/monetization/premium";
import { errorText } from "../../src/ui";

function friendsNote(names: string[] | undefined): string | null {
  if (!names?.length) return null;
  if (names.length === 1) return `${names[0]} is going`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are going`;
  return `${names[0]} and ${names.length - 1} other friends are going`;
}

export default function TournamentsTab() {
  const router = useRouter();
  const { enabled, profile } = useAuth();
  const fr = useFriends();
  const community = useCommunity();
  const theme = useCalendarTheme();
  const { ready, homeState, setHomeState } = useHomeState();
  // First launch on a new phone: ask where they shoot. "Cancel" shows every state for now, and we ask again next launch.
  const [skipped, setSkipped] = useState(false);
  const { openSheet } = usePremium();
  const { featured, refresh: refreshFeatured } = useFeatured();
  const [showFeatured] = useShowFeatured();
  const [featureFor, setFeatureFor] = useState<TournamentEvent | null>(null);

  const social = useMemo<CalendarSocial | undefined>(() => {
    if (!enabled) return undefined; // no accounts yet: the calendar works on its own
    return {
      extraEvents: community.events,
      onRefresh: () => {
        community.refresh();
        fr.refresh();
      },
      onAddEvent: () => router.push("/tournament/new"),
      // Signed in: ask who can see it (every choice is saved to their account, so a new phone
      // gets it back; "Just me" ones only they can see). Signed out: Going stays on the phone, as before.
      beforeGoing: async (event: TournamentEvent) => {
        if (!fr.active) return true;
        const level = await askShareLevel(event.name);
        if (!level) return false;
        fr.setShareLevel(event, level).catch((e) => Alert.alert("Couldn't share it", errorText(e)));
        return true;
      },
      // Un-starred: take it out of their account too ("Just me" ones are saved there as well).
      onGoingChange: (event, going) => {
        if (!going && fr.active) fr.removeGoing(event.id).catch(() => {});
      },
      rowNote: (event) => friendsNote(fr.friendsGoing.get(event.id)),
      renderDetail: (event, going, close) => (
        <>
          <GoingWith event={event} going={going} close={close} />
          {event.source === "USER" ? <CommunityActions event={event} close={close} /> : null}
          <FeatureButton event={event} close={close} onFeature={setFeatureFor} />
        </>
      ),
    };
  }, [enabled, community, fr, router]);

  // The tab bar below handles the bottom safe area.
  return (
    <>
      <CalendarScreen
        apiBaseUrl={API_BASE_URL}
        title="Archery in the USA"
        bottomInset={0}
        social={social}
        sharePlug={SHARE_PLUG}
        shareAs={{ name: profile?.display_name, archeryClass: profile?.archery_class }}
        homeState={homeState}
        hotels={HOTELS}
        flights={FLIGHTS}
        listAd={() => <ListAd onRemoveAds={openSheet} />}
        adEvery={ADS.every}
        featured={showFeatured ? featured : undefined}
        onFeaturedSeen={countSeen}
        onFeaturedOpen={countOpened}
      />
      {featureFor && profile ? (
        <FeatureSheet
          event={featureFor}
          visible
          onClose={() => setFeatureFor(null)}
          onFeatured={refreshFeatured}
          promoterName={profile.display_name}
        />
      ) : null}
      <StatePicker
        visible={ready && !homeState && !skipped}
        value={null}
        theme={theme}
        title="Where do you shoot?"
        onClose={() => setSkipped(true)}
        onPick={(code) => setHomeState(code)}
      />
    </>
  );
}
