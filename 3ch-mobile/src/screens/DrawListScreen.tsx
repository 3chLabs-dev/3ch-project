import { useNavigation, useRoute } from "@react-navigation/native";
import { StyleSheet, Text, View } from "react-native";
import { useGetDrawsQuery } from "../api/mobileApi";
import { Screen } from "../components/Screen";
import { Card, Empty, Loading, PageHeader } from "../components/Ui";
import { colors } from "../theme";

export function DrawListScreen() {
  const navigation = useNavigation<any>(); const leagueId = useRoute<any>().params.leagueId as string; const query = useGetDrawsQuery(leagueId);
  return <Screen refreshing={query.isFetching} onRefresh={query.refetch}><PageHeader title="추첨 목록" />{query.isLoading ? <Loading /> : null}{query.data?.draws.length ? query.data.draws.map((d) => <Card key={d.id}><Text style={styles.title} onPress={() => navigation.navigate("DrawDetail", { leagueId, drawId: d.id })}>{d.name}</Text><View style={styles.row}><Text style={styles.meta}>경품 {d.prize_count}개</Text><Text style={styles.meta}>당첨 {d.winner_count}/{d.total_quantity}명</Text></View></Card>) : <Empty message="생성된 추첨이 없습니다." />}</Screen>;
}
const styles = StyleSheet.create({ title: { color: colors.text, fontSize: 16, fontWeight: "900" }, row: { flexDirection: "row", justifyContent: "space-between" }, meta: { color: colors.muted, fontSize: 12 } });
