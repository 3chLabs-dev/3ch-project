import { useNavigation, useRoute } from "@react-navigation/native";
import { StyleSheet, Text, View } from "react-native";
import { useGetLeagueQuery, useGetParticipantsQuery } from "../api/mobileApi";
import { Screen } from "../components/Screen";
import { Button, Card, Empty, Loading, PageHeader } from "../components/Ui";
import { colors } from "../theme";

export function LeagueDetailScreen() {
  const navigation = useNavigation<any>();
  const id = useRoute<any>().params.id as string;
  const leagueQuery = useGetLeagueQuery(id);
  const participants = useGetParticipantsQuery(id);
  const league = leagueQuery.data?.league;
  return <Screen refreshing={leagueQuery.isFetching || participants.isFetching} onRefresh={() => { leagueQuery.refetch(); participants.refetch(); }}>
    <PageHeader title="리그 상세" />
    {leagueQuery.isLoading ? <Loading /> : null}
    {league ? <Card>
      <Text style={styles.name}>{league.title || league.name}</Text>
      <Text style={styles.meta}>{league.sport ?? "종목"} · {league.type ?? "리그"} · {league.status}</Text>
      <Text style={styles.meta}>{league.start_date ? new Date(league.start_date).toLocaleString("ko-KR") : "일정 미정"}</Text>
      <Text style={styles.meta}>참가자 {league.participant_count ?? participants.data?.participants.length ?? 0} / {league.recruit_count ?? 0}명</Text>
    </Card> : null}
    <View style={styles.actions}>
      <View style={styles.grow}><Button title="참가자 관리" onPress={() => navigation.navigate("Participants", { id })} /></View>
      <View style={styles.grow}><Button title="경기 진행" onPress={() => navigation.navigate("Matches", { id })} /></View>
    </View>
    <Text style={styles.section}>참가자</Text>
    {participants.data?.participants.length ? participants.data.participants.slice(0, 10).map((p) => <Card key={p.id}><View style={styles.row}><Text style={styles.person}>{p.name}</Text><Text style={styles.meta}>{p.division ?? "미배정"}</Text></View></Card>) : <Empty message="참가자가 없습니다." />}
  </Screen>;
}

const styles = StyleSheet.create({
  name: { color: colors.text, fontSize: 22, fontWeight: "900" },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  actions: { flexDirection: "row", gap: 8 },
  grow: { flex: 1 },
  section: { color: colors.text, fontSize: 18, fontWeight: "900" },
  row: { flexDirection: "row", justifyContent: "space-between" },
  person: { color: colors.text, fontWeight: "800" },
});
