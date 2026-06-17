import { useRoute } from "@react-navigation/native";
import { StyleSheet, Text } from "react-native";
import { useGetDrawDetailQuery } from "../api/mobileApi";
import { Screen } from "../components/Screen";
import { Card, Empty, Loading, PageHeader } from "../components/Ui";
import { colors } from "../theme";

export function DrawDetailScreen() {
  const { leagueId, drawId } = useRoute<any>().params; const query = useGetDrawDetailQuery({ leagueId, drawId });
  return <Screen refreshing={query.isFetching} onRefresh={query.refetch}><PageHeader title={query.data?.draw.name ?? "추첨 결과"} />{query.isLoading ? <Loading /> : null}{query.data?.prizes.length ? query.data.prizes.map((p) => <Card key={p.id}><Text style={styles.prize}>{p.prize_name} · {p.quantity}명</Text>{p.winners.length ? p.winners.map((w) => <Text key={w.id} style={styles.winner}>당첨 · {w.participant_name} {w.participant_division ? `(${w.participant_division})` : ""}</Text>) : <Text style={styles.meta}>아직 당첨자가 없습니다.</Text>}</Card>) : <Empty message="경품 정보가 없습니다." />}</Screen>;
}
const styles = StyleSheet.create({ prize: { color: colors.text, fontSize: 17, fontWeight: "900" }, winner: { color: "#D97706", fontWeight: "800" }, meta: { color: colors.muted, fontSize: 12 } });
