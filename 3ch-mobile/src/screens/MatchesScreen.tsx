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
  return <Screen refreshing={query.isFetching} onRefresh={query.refetch}><PageHeader title="\uacbd\uae30 \uc9c4\ud589" />
    {!query.data?.matches.length ? <Button loading={initState.isLoading} title="\uacbd\uae30\ud45c \uc0dd\uc131" onPress={() => init(id)} /> : null}
    {query.data?.matches.length ? query.data.matches.map((match) => <Card key={match.id}><View style={styles.row}><Text style={styles.order}>{match.match_order}\ubc88 \uacbd\uae30</Text><Text style={styles.status}>{match.status === "playing" ? "\uc9c4\ud589 \uc911" : match.status === "done" ? "\uc885\ub8cc" : "\ub300\uae30"}</Text></View><View style={styles.scoreRow}><Text style={styles.player}>{match.participant_a_name ?? "\ubbf8\uc815"}</Text><Text style={styles.score}>{match.score_a ?? 0} : {match.score_b ?? 0}</Text><Text style={styles.player}>{match.participant_b_name ?? "\ubbf8\uc815"}</Text></View><View style={styles.buttons}><View style={styles.grow}><Button title="\uc67c\ucabd +1" onPress={() => update({ leagueId: id, matchId: match.id, updates: { score_a: (match.score_a ?? 0) + 1 } })} /></View><View style={styles.grow}><Button title="\uc624\ub978\ucabd +1" onPress={() => update({ leagueId: id, matchId: match.id, updates: { score_b: (match.score_b ?? 0) + 1 } })} /></View><View style={styles.grow}><Button title={match.status === "done" ? "\uc885\ub8cc\ub428" : "\uacbd\uae30 \uc885\ub8cc"} onPress={() => update({ leagueId: id, matchId: match.id, updates: { status: "done" } })} /></View></View></Card>) : <Empty message="\uc0dd\uc131\ub41c \uacbd\uae30\uac00 \uc5c6\uc2b5\ub2c8\ub2e4." />}
  </Screen>;
}
const styles = StyleSheet.create({ row: { flexDirection: "row", justifyContent: "space-between" }, order: { color: colors.text, fontWeight: "900" }, status: { color: colors.primary, fontWeight: "800", fontSize: 11 }, scoreRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, player: { flex: 1, textAlign: "center", color: colors.text, fontWeight: "700" }, score: { color: colors.text, fontSize: 24, fontWeight: "900" }, buttons: { flexDirection: "row", gap: 5 }, grow: { flex: 1 } });
