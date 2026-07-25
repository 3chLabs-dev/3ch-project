import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useGetLeaguesQuery, useGetMyGroupsQuery } from "../api/mobileApi";
import { Screen } from "../components/Screen";
import { GroupSelector } from "../components/GroupSelector";
import { Button, Card, Empty, ErrorMessage, Header, Loading } from "../components/Ui";
import { colors } from "../theme";
import { persistPreferredGroup } from "../store/appSlice";
import { useAppDispatch, useAppSelector } from "../store/hooks";

export function LeaguesScreen() {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const preferredGroupId = useAppSelector((state) => state.app.preferredGroupId);
  const groups = useGetMyGroupsQuery();
  const groupItems = groups.data?.groups ?? [];
  const selectedGroup = groupItems.find((group) => group.id === preferredGroupId) ?? groupItems[0];
  const query = useGetLeaguesQuery(selectedGroup ? { groupId: selectedGroup.id } : undefined);
  const canCreate = selectedGroup?.role === "owner" || selectedGroup?.role === "admin";
  const leagues = useMemo(() => query.data?.leagues ?? [], [query.data]);
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "active" | "completed">("all");
  const visibleLeagues = useMemo(() => statusFilter === "all" ? leagues : leagues.filter((league) => league.status === statusFilter), [leagues, statusFilter]);

  return (
    <Screen refreshing={query.isFetching} onRefresh={query.refetch}>
      <View style={styles.topRow}>
        <Header title="리그·대회" subtitle={selectedGroup ? `${selectedGroup.name} 일정` : "리그 일정을 확인하세요."} />
        <GroupSelector
          groups={groupItems}
          selected={selectedGroup}
          onSelect={(group) => dispatch(persistPreferredGroup(group.id))}
        />
      </View>
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>리그 일정</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="리그 필터" onPress={() => setShowFilters((value) => !value)} hitSlop={8}><Ionicons name="options-outline" size={21} color={colors.text} /></Pressable>
      </View>
      {showFilters ? <View style={styles.filters}>{(["all", "draft", "active", "completed"] as const).map((status) => <Pressable key={status} onPress={() => setStatusFilter(status)} style={[styles.filter, statusFilter === status && styles.filterActive]}><Text style={[styles.filterText, statusFilter === status && styles.filterTextActive]}>{status === "all" ? "전체" : status === "draft" ? "예정" : status === "active" ? "진행 중" : "종료"}</Text></Pressable>)}</View> : null}
      {query.isLoading ? <Loading /> : null}
      {query.isError ? <ErrorMessage message="리그 목록을 불러오지 못했습니다." /> : null}
      {!visibleLeagues.length && !query.isLoading ? <Empty message={leagues.length ? "조건에 맞는 리그가 없습니다." : "개설된 리그가 없습니다."} /> : null}
      {visibleLeagues.map((league) => (
        <Pressable key={league.id} onPress={() => navigation.navigate("LeagueDetail", { id: league.id })}>
        <Card key={league.id}>
          <View style={styles.row}>
            <View style={styles.sportIcon}><Text>{league.sport === "탁구" ? "🏓" : league.sport === "배드민턴" ? "🏸" : league.sport === "테니스" ? "🎾" : "🏆"}</Text></View>
            <View style={styles.grow}>
              <View style={styles.titleRow}><Text numberOfLines={1} style={styles.title}>{league.title || league.name}</Text><Text style={[styles.status, league.status === "active" ? styles.active : league.status === "completed" ? styles.completed : styles.draft]}>{league.status === "active" ? "진행 중" : league.status === "completed" ? "종료" : "예정"}</Text></View>
              <Text style={styles.type}>{league.type ?? league.sport ?? "리그"}</Text>
              <Text style={styles.muted}>{formatDate(league.start_date)}</Text>
            </View>
            <Text style={styles.count}>{league.participant_count ?? 0} / {league.recruit_count ?? 0}명</Text>
          </View>
        </Card>
        </Pressable>
      ))}
      {canCreate ? <Button title="신규 생성" onPress={() => navigation.navigate("LeagueCreate", { groupId: selectedGroup?.id })} /> : null}
      <Text style={styles.sectionTitle}>대회 일정</Text>
      <Empty message="개설된 대회가 없습니다." />
    </Screen>
  );
}

function formatDate(value?: string) {
  if (!value) return "일정 미정";
  return new Date(value).toLocaleString("ko-KR", { month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" });
}

const styles = StyleSheet.create({
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { color: colors.text, fontWeight: "900", fontSize: 18 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  grow: { flex: 1 },
  sportIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.blueSoft, alignItems: "center", justifyContent: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { color: colors.text, fontSize: 15, fontWeight: "800", flex: 1 },
  type: { color: "#4B5563", fontSize: 12, fontWeight: "700", marginTop: 3 },
  status: { overflow: "hidden", borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, fontSize: 10, fontWeight: "800" },
  draft: { color: "#1D4ED8", backgroundColor: "#DBEAFE" }, active: { color: "#047857", backgroundColor: "#D1FAE5" }, completed: { color: "#6B7280", backgroundColor: "#F3F4F6" },
  muted: { color: colors.muted, fontSize: 12, marginTop: 4 },
  count: { color: colors.muted, fontWeight: "700", fontSize: 12 },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filter: { borderRadius: 999, backgroundColor: "#F3F4F6", paddingHorizontal: 12, paddingVertical: 8 },
  filterActive: { backgroundColor: colors.text },
  filterText: { color: "#374151", fontSize: 12, fontWeight: "800" },
  filterTextActive: { color: "#FFFFFF" },
});
