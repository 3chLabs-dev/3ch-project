import { useNavigation, useRoute } from "@react-navigation/native";
import { StyleSheet, Text, View } from "react-native";
import { useGetGroupDetailQuery, useGetLeagueQuery, useGetParticipantsQuery } from "../api/mobileApi";
import { Screen } from "../components/Screen";
import { Button, Card, Empty, Loading, PageHeader } from "../components/Ui";
import { colors } from "../theme";

export function LeagueDetailScreen() {
  const navigation = useNavigation<any>();
  const id = useRoute<any>().params.id as string;
  const leagueQuery = useGetLeagueQuery(id);
  const participants = useGetParticipantsQuery(id);
  const league = leagueQuery.data?.league;
  const groupQuery = useGetGroupDetailQuery(league?.group_id ?? "", { skip: !league?.group_id });
  const canManage = groupQuery.data?.myRole === "owner" || groupQuery.data?.myRole === "admin";
  return <Screen refreshing={leagueQuery.isFetching || participants.isFetching} onRefresh={() => { leagueQuery.refetch(); participants.refetch(); }}>
    <PageHeader title="\ub9ac\uadf8 \uc0c1\uc138" />
    {leagueQuery.isLoading ? <Loading /> : null}
    {league ? <Card><Text style={styles.name}>{league.title || league.name}</Text><Text style={styles.meta}>{league.sport ?? "\uc885\ubaa9"} \u00b7 {league.type ?? "\ub9ac\uadf8"} \u00b7 {league.status}</Text><Text style={styles.meta}>{league.start_date ? new Date(league.start_date).toLocaleString("ko-KR") : "\uc77c\uc815 \ubbf8\uc815"}</Text><Text style={styles.meta}>\ucc38\uac00\uc790 {league.participant_count ?? participants.data?.participants.length ?? 0} / {league.recruit_count ?? 0}\uba85</Text></Card> : null}
    {canManage ? <View style={styles.actions}><View style={styles.grow}><Button title="\ucc38\uac00\uc790 \uad00\ub9ac" onPress={() => navigation.navigate("Participants", { id })} /></View><View style={styles.grow}><Button title="\uacbd\uae30 \uc9c4\ud589" onPress={() => navigation.navigate("Matches", { id })} /></View></View> : null}
    {canManage ? <Button title="\uc870 \ud3b8\uc131 \uad00\ub9ac" onPress={() => navigation.navigate("LeagueGrouping", { id })} /> : null}
    <Button title="\ud1a0\ub108\uba3c\ud2b8 \ub300\uc9c4\ud45c" onPress={() => navigation.navigate("TournamentList", { id })} />
    {canManage ? <Button title="\ub9ac\uadf8 \uad00\ub9ac" onPress={() => navigation.navigate("LeagueManage", { id })} /> : null}
    <Text style={styles.section}>\ucc38\uac00\uc790</Text>
    {participants.data?.participants.length ? participants.data.participants.slice(0, 10).map((participant) => <Card key={participant.id}><View style={styles.row}><Text style={styles.person}>{participant.name}</Text><Text style={styles.meta}>{participant.division ?? "\ubbf8\ubc30\uc815"}</Text></View></Card>) : <Empty message="\ucc38\uac00\uc790\uac00 \uc5c6\uc2b5\ub2c8\ub2e4." />}
  </Screen>;
}
const styles = StyleSheet.create({ name: { color: colors.text, fontSize: 22, fontWeight: "900" }, meta: { color: colors.muted, fontSize: 12, lineHeight: 18 }, actions: { flexDirection: "row", gap: 8 }, grow: { flex: 1 }, section: { color: colors.text, fontSize: 18, fontWeight: "900" }, row: { flexDirection: "row", justifyContent: "space-between" }, person: { color: colors.text, fontWeight: "800" } });
