import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
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
        <Ionicons name="options-outline" size={21} color={colors.text} />
      </View>
      {query.isLoading ? <Loading /> : null}
      {query.isError ? <ErrorMessage message="리그 목록을 불러오지 못했습니다." /> : null}
      {!leagues.length && !query.isLoading ? <Empty message="개설된 리그가 없습니다." /> : null}
      {leagues.map((league) => (
        <Pressable key={league.id} onPress={() => navigation.navigate("LeagueDetail", { id: league.league_code ?? league.id })}>
        <Card key={league.id}>
          <View style={styles.row}>
            <View style={styles.grow}>
              <Text style={styles.title}>{league.title || league.name} | {league.type ?? league.sport ?? "리그"}</Text>
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
  title: { color: colors.text, fontSize: 15, fontWeight: "800" },
  muted: { color: colors.muted, fontSize: 12, marginTop: 4 },
  count: { color: colors.muted, fontWeight: "700", fontSize: 12 },
});
