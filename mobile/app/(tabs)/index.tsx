import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert } from "react-native";
import { API_BASE_URL, SHARE_PLUG } from "../../config";
import { CalendarScreen, StatePicker, useCalendarTheme, type CalendarSocial, type TournamentEvent } from "../../src/features/calendar";
import { CommunityActions, useCommunity } from "../../src/features/community";
import { GoingWith, askShareLevel, useFriends } from "../../src/features/friends";
import { useAuth } from "../../src/lib/auth";
import { useHomeState } from "../../src/lib/homeState";
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
  // First launch on a new phone: ask where they shoot. "Cancel" shows every state for now.
  const [skipped, setSkipped] = useState(false);

  const social = useMemo<CalendarSocial | undefined>(() => {
    if (!enabled) return undefined; // no accounts yet: the calendar works on its own
    return {
      extraEvents: community.events,
      onRefresh: () => {
        community.refresh();
        fr.refresh();
      },
      onAddEvent: () => router.push("/tournament/new"),
      // Signed in: ask who can see it. Signed out: Going stays on the phone, as before.
      beforeGoing: async (event: TournamentEvent) => {
        if (!fr.active) return true;
        const level = await askShareLevel(event.name);
        if (!level) return false;
        fr.setShareLevel(event, level).catch((e) => Alert.alert("Couldn't share it", errorText(e)));
        return true;
      },
      onGoingChange: (event, going) => {
        if (!going && fr.active && fr.shareLevelFor(event.id) !== "private") {
          fr.setShareLevel(event, "private").catch(() => {});
        }
      },
      rowNote: (event) => friendsNote(fr.friendsGoing.get(event.id)),
      renderDetail: (event, going, close) => (
        <>
          <GoingWith event={event} going={going} close={close} />
          {event.source === "USER" ? <CommunityActions event={event} close={close} /> : null}
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
      />
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
