import { useRoute } from "@react-navigation/native";
import { StyleSheet, Text, View } from "react-native";
import { useGetGroupRankingQuery } from "../api/mobileApi";
import { Screen } from "../components/Screen";
import { Card, Empty, Loading, PageHeader } from "../components/Ui";
import { colors } from "../theme";

export function ClubRankingScreen() {
  const { groupId, title } = useRoute<any>().params;
  const query = useGetGroupRankingQuery(groupId);
  return (
    <Screen refreshing={query.isFetching} onRefresh={query.refetch}>
      <PageHeader title={`${title} 순위`} />
      {query.isLoading ? <Loading /> : null}
      {query.data?.rankings.length
        ? query.data.rankings.map((row) => (
          <Card key={row.member_id}>
            <View style={styles.row}>
              <Text style={styles.rank}>{row.rank}위</Text>
              <View style={styles.grow}>
                <Text style={styles.name}>{row.name}</Text>
                <Text style={styles.meta}>{row.wins}승 {row.losses}패 · 승률 {row.win_rate}%</Text>
              </View>
              <Text style={styles.rating}>{row.rating}</Text>
            </View>
          </Card>
        ))
        : !query.isLoading ? <Empty message="클럽 순위 정보가 없습니다." /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  rank: { width: 38, color: colors.primary, fontWeight: "900" },
  grow: { flex: 1 },
  name: { color: colors.text, fontWeight: "900" },
  meta: { color: colors.muted, fontSize: 11 },
  rating: { color: colors.primary, fontWeight: "900" },
});
