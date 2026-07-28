import { useRoute } from "@react-navigation/native";
import { StyleSheet, Text, View } from "react-native";
import { useGetMatchesQuery, useInitMatchesMutation, useUpdateMatchMutation } from "../api/mobileApi";
import { Screen } from "../components/Screen";
import { Button, Card, Empty, PageHeader } from "../components/Ui";
import { colors } from "../theme";

export function MatchesScreen() {
  const id = useRoute<any>().params.id as string;
  const query = useGetMatchesQuery(id);
  const [init, initState] = useInitMatchesMutation();
  const [update] = useUpdateMatchMutation();
  return <Screen refreshing={query.isFetching} onRefresh={query.refetch}><PageHeader title="경기 진행" />
    {!query.data?.matches.length ? <Button loading={initState.isLoading} title="경기표 생성" onPress={() => init(id)} /> : null}
    {query.data?.matches.length ? query.data.matches.map((match) => <Card key={match.id}><View style={styles.row}><Text style={styles.order}>{match.match_order}번 경기</Text><Text style={styles.status}>{match.status === "playing" ? "진행 중" : match.status === "done" ? "종료" : "대기"}</Text></View><View style={styles.scoreRow}><Text style={styles.player}>{match.participant_a_name ?? "미정"}</Text><Text style={styles.score}>{match.score_a ?? 0} : {match.score_b ?? 0}</Text><Text style={styles.player}>{match.participant_b_name ?? "미정"}</Text></View><View style={styles.buttons}><View style={styles.grow}><Button title="왼쪽 +1" onPress={() => update({ leagueId: id, matchId: match.id, updates: { score_a: (match.score_a ?? 0) + 1 } })} /></View><View style={styles.grow}><Button title="오른쪽 +1" onPress={() => update({ leagueId: id, matchId: match.id, updates: { score_b: (match.score_b ?? 0) + 1 } })} /></View><View style={styles.grow}><Button title={match.status === "done" ? "종료됨" : "경기 종료"} onPress={() => update({ leagueId: id, matchId: match.id, updates: { status: "done" } })} /></View></View></Card>) : <Empty message="생성된 경기가 없습니다." />}
  </Screen>;
}
const styles = StyleSheet.create({ row: { flexDirection: "row", justifyContent: "space-between" }, order: { color: colors.text, fontWeight: "900" }, status: { color: colors.primary, fontWeight: "800", fontSize: 11 }, scoreRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, player: { flex: 1, textAlign: "center", color: colors.text, fontWeight: "700" }, score: { color: colors.text, fontSize: 24, fontWeight: "900" }, buttons: { flexDirection: "row", gap: 5 }, grow: { flex: 1 } });
