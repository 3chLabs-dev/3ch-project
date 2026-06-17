import { useRoute } from "@react-navigation/native";
import { StyleSheet, Text, View } from "react-native";
import { useGetSportRankingQuery } from "../api/mobileApi";
import { Screen } from "../components/Screen";
import { Card, Empty, Loading, PageHeader } from "../components/Ui";
import { useAppSelector } from "../store/hooks";
import { colors } from "../theme";

export function SportRankingScreen() {
  const sport = useRoute<any>().params.sport as string;
  const userId = useAppSelector((state) => state.auth.user?.id);
  const query = useGetSportRankingQuery(sport);
  return <Screen refreshing={query.isFetching} onRefresh={query.refetch}><PageHeader title={`${sport} 개인 순위`} />{query.isLoading ? <Loading /> : null}{query.data ? <Card style={styles.summary}><Text style={styles.summaryTitle}>내 순위 {query.data.my_ranking?.rank ? `${query.data.my_ranking.rank}위` : "-"}</Text><Text style={styles.meta}>레이팅 {query.data.my_ranking?.rating ?? "-"} · 반영 경기 {query.data.summary.match_count}경기</Text></Card> : null}{query.data?.rankings.length ? query.data.rankings.map((row) => <Card key={row.member_id} style={row.member_id === userId ? styles.mine : undefined}><View style={styles.row}><Text style={styles.rank}>{row.rank ?? "-"}</Text><View style={styles.grow}><Text style={styles.name}>{row.name}{row.member_id === userId ? " · 나" : ""}</Text><Text style={styles.meta}>{row.wins}승 {row.losses}패 · 승률 {row.win_rate}%</Text></View><Text style={styles.rating}>{row.rating}</Text></View></Card>) : !query.isLoading ? <Empty message="반영된 순위 기록이 없습니다." /> : null}</Screen>;
}
const styles = StyleSheet.create({ summary: { backgroundColor: colors.blueSoft }, summaryTitle: { color: colors.primary, fontSize: 18, fontWeight: "900" }, row: { flexDirection: "row", alignItems: "center", gap: 12 }, rank: { width: 32, color: colors.primary, fontSize: 18, fontWeight: "900", textAlign: "center" }, grow: { flex: 1 }, name: { color: colors.text, fontWeight: "900" }, meta: { color: colors.muted, fontSize: 11 }, rating: { color: colors.primary, fontWeight: "900" }, mine: { borderWidth: 1, borderColor: colors.primary } });
