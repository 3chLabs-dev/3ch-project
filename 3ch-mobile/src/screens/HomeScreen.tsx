import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useMemo } from "react";
import {
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  type League,
  useGetHomeSummaryQuery,
  useGetLeaguesQuery,
  useGetMyGroupsQuery,
  useGetPreferencesQuery,
} from "../api/mobileApi";
import { GroupSelector } from "../components/GroupSelector";
import { Screen } from "../components/Screen";
import { Card, Empty, ErrorMessage, Loading } from "../components/Ui";
import { persistPreferredGroup } from "../store/appSlice";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { colors } from "../theme";

const banner = require("../../assets/home-banner.png");

export function HomeScreen() {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const preferredGroupId = useAppSelector((state) => state.app.preferredGroupId);
  const groupsQuery = useGetMyGroupsQuery();
  const groups = groupsQuery.data?.groups ?? [];
  const selectedGroup = groups.find((group) => group.id === preferredGroupId) ?? groups[0];
  const summaryQuery = useGetHomeSummaryQuery(selectedGroup ? { groupId: selectedGroup.id } : undefined);
  const leaguesQuery = useGetLeaguesQuery(selectedGroup ? { groupId: selectedGroup.id } : undefined);
  const preferencesQuery = useGetPreferencesQuery();
  const refreshing = groupsQuery.isFetching || summaryQuery.isFetching || leaguesQuery.isFetching;

  const { activeLeagues, scheduledLeagues } = useMemo(() => {
    const now = new Date();
    const leagues = leaguesQuery.data?.leagues ?? [];
    return {
      activeLeagues: leagues.filter((league) => league.status === "active").slice(0, 5),
      scheduledLeagues: leagues.filter((league) => league.status === "draft" && new Date(league.start_date ?? 0) >= now).slice(0, 5),
    };
  }, [leaguesQuery.data]);

  const refresh = () => {
    groupsQuery.refetch();
    summaryQuery.refetch();
    leaguesQuery.refetch();
  };

  return (
    <Screen contentStyle={styles.screen} refreshing={refreshing} onRefresh={refresh}>
      <ImageBackground source={banner} resizeMode="cover" style={styles.hero}>
        <Pressable style={styles.heroButton} onPress={() => navigation.navigate("리그·대회")}>
          <Text style={styles.heroButtonText}>지금 시작하기</Text>
        </Pressable>
      </ImageBackground>

      <View style={styles.padding}>
        <View style={styles.userRow}>
          <View style={styles.divisionCircle}><Text style={styles.divisionText}>{selectedGroup?.division ?? "-"}</Text></View>
          <Text style={styles.greeting}>{user?.name ?? "회원"}</Text>
          <GroupSelector
            groups={groups}
            selected={selectedGroup}
            onSelect={(group) => dispatch(persistPreferredGroup(group.id))}
          />
        </View>
        {selectedGroup ? (
          <Card style={styles.clubCard}>
            <View style={styles.iconCircle}><Ionicons name="people" size={22} color={colors.primary} /></View>
            <View style={styles.grow}>
              <Text style={styles.clubName}>{selectedGroup.name}</Text>
              <Text style={styles.muted}>
                {[selectedGroup.region_city, selectedGroup.region_district].filter(Boolean).join(" ") ||
                  `멤버 ${selectedGroup.member_count ?? 0}명`}
              </Text>
            </View>
            <Text style={styles.detail}>자세히 보기</Text>
          </Card>
        ) : (
          <Empty message="가입한 클럽이 없습니다." />
        )}
      </View>

      {summaryQuery.isLoading ? <Loading /> : null}
      {summaryQuery.isError ? <View style={styles.padding}><ErrorMessage message="홈 정보를 불러오지 못했습니다." /></View> : null}

      {(preferencesQuery.data?.show_group ?? true) ? <HomeSection color={colors.indigoSoft} icon="grid-outline" iconColor="#6366F1" title="나의 조편성">
        {summaryQuery.data?.my_groups.length ? summaryQuery.data.my_groups.map((item) => (
          <Card key={item.league_id}>
            <View style={styles.row}>
              <Text style={styles.cardTitle}>{item.league_name}</Text>
              <Badge label={item.division ?? "미배정"} color="#6366F1" background="#EEF2FF" />
            </View>
          </Card>
        )) : <Empty message="배정된 조편성이 없습니다." />}
      </HomeSection> : null}

      {(preferencesQuery.data?.show_game ?? true) ? <HomeSection color={colors.blueSoft} icon="tennisball-outline" iconColor={colors.primary} title="나의 경기">
        {summaryQuery.data?.my_matches.length ? summaryQuery.data.my_matches.map((match) => (
          <Card key={match.match_id}>
            <Text style={styles.smallTitle}>{match.league_name}</Text>
            <View style={styles.row}>
              <Text style={styles.cardTitle}>{match.my_division ?? "나"}  vs  {match.opponent_name ?? "미정"}</Text>
              <Badge
                label={match.status === "playing" ? "진행중" : "대기"}
                color={match.status === "playing" ? "#16A34A" : colors.muted}
                background={match.status === "playing" ? "#DCFCE7" : "#F3F4F6"}
              />
            </View>
          </Card>
        )) : <Empty message="예정된 경기가 없습니다." />}
      </HomeSection> : null}

      {(preferencesQuery.data?.show_win ?? true) ? <HomeSection color={colors.amberSoft} icon="gift-outline" iconColor="#D97706" title="나의 당첨내역">
        {summaryQuery.data?.my_wins.length ? summaryQuery.data.my_wins.map((win, index) => (
          <Card key={`${win.league_id}-${index}`}>
            <Text style={styles.smallTitle}>{win.league_name} · {win.draw_name ?? "추첨"}</Text>
            <View style={styles.row}>
              <Text style={styles.cardTitle}>{win.prize_name}</Text>
              <Badge label="당첨" color="#D97706" background="#FEF3C7" />
            </View>
          </Card>
        )) : <Empty message="당첨 내역이 없습니다." />}
      </HomeSection> : null}

      <LeagueSection title="진행중인 리그·대회" leagues={activeLeagues} color={colors.strongBlueSoft} />
      <LeagueSection title="다음 리그·대회" leagues={scheduledLeagues} color={colors.surface} />
    </Screen>
  );
}

function HomeSection({
  title,
  icon,
  iconColor,
  color,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.section, { backgroundColor: color }]}>
      <View style={styles.sectionTitleRow}>
        <Ionicons name={icon} color={iconColor} size={19} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

function LeagueSection({ title, leagues, color }: { title: string; leagues: League[]; color: string }) {
  return (
    <View style={[styles.section, { backgroundColor: color }]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>
        {leagues.length ? leagues.map((league) => (
          <Card key={league.id}>
            <View style={styles.row}>
              <View style={styles.grow}>
                <Text style={styles.cardTitle}>{league.title || league.name}</Text>
                <Text style={styles.muted}>{formatDate(league.start_date)} · {league.type ?? league.sport ?? "리그"}</Text>
              </View>
              <Text style={styles.count}>{league.participant_count ?? 0} / {league.recruit_count ?? 0}명</Text>
            </View>
          </Card>
        )) : <Empty message="표시할 리그·대회가 없습니다." />}
      </View>
    </View>
  );
}

function Badge({ label, color, background }: { label: string; color: string; background: string }) {
  return <Text style={[styles.badge, { color, backgroundColor: background }]}>{label}</Text>;
}

function formatDate(value?: string) {
  if (!value) return "일정 미정";
  return new Date(value).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
}

const styles = StyleSheet.create({
  screen: { padding: 0, gap: 0 },
  hero: { width: "100%", aspectRatio: 3 / 2, justifyContent: "flex-end", alignItems: "center", paddingBottom: 24 },
  heroButton: {
    paddingHorizontal: 42,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "#D9D9D9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  heroButtonText: { color: colors.primaryDark, fontSize: 18, fontWeight: "700" },
  padding: { padding: 16, gap: 14 },
  userRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  divisionCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#FAAA47", alignItems: "center", justifyContent: "center" },
  divisionText: { color: "#000", fontSize: 12, fontWeight: "900" },
  greeting: { color: colors.text, fontSize: 21, fontWeight: "900" },
  clubCard: { flexDirection: "row", alignItems: "center" },
  iconCircle: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: colors.blueSoft },
  grow: { flex: 1 },
  clubName: { color: colors.text, fontWeight: "800", fontSize: 16 },
  detail: { color: "#374151", fontWeight: "700", fontSize: 12 },
  muted: { color: colors.muted, fontWeight: "600", fontSize: 12, marginTop: 3 },
  section: { paddingHorizontal: 16, paddingVertical: 18, gap: 14 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionTitle: { color: colors.text, fontWeight: "900", fontSize: 19 },
  sectionContent: { gap: 10 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  cardTitle: { color: colors.text, fontWeight: "800", fontSize: 14, flexShrink: 1 },
  smallTitle: { color: colors.muted, fontWeight: "700", fontSize: 12 },
  count: { color: colors.muted, fontWeight: "700", fontSize: 12 },
  badge: { overflow: "hidden", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, fontWeight: "800", fontSize: 11 },
});
