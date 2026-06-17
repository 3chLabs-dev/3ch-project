import { useRoute } from "@react-navigation/native";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useGetGroupDetailQuery, useGetGroupRankingQuery, useJoinGroupMutation, useLeaveGroupMutation } from "../api/mobileApi";
import { Screen } from "../components/Screen";
import { Button, Card, Empty, Loading, PageHeader } from "../components/Ui";
import { colors } from "../theme";

export function GroupDetailScreen() {
  const id = useRoute<any>().params.id as string;
  const query = useGetGroupDetailQuery(id);
  const ranking = useGetGroupRankingQuery(id, { skip: !query.data });
  const [join, joinState] = useJoinGroupMutation();
  const [leave, leaveState] = useLeaveGroupMutation();
  const detail = query.data;
  const isMember = !!detail?.myRole;

  return (
    <Screen refreshing={query.isFetching} onRefresh={query.refetch}>
      <PageHeader title="클럽 상세" />
      {query.isLoading ? <Loading /> : null}
      {detail ? (
        <>
          <Card>
            <Text style={styles.name}>{detail.group.name}</Text>
            <Text style={styles.meta}>{detail.group.sport ?? "종목 미설정"} · {[detail.group.region_city, detail.group.region_district].filter(Boolean).join(" ") || "지역 미설정"}</Text>
            <Text style={styles.desc}>{detail.group.description || "클럽 소개가 없습니다."}</Text>
            <Text style={styles.meta}>회원 {detail.members.length}명 · 내 역할 {detail.myRole || "미가입"}</Text>
          </Card>
          {isMember ? (
            <Button loading={leaveState.isLoading} tone="danger" title="클럽 탈퇴" onPress={() => Alert.alert("클럽 탈퇴", "클럽에서 탈퇴할까요?", [
              { text: "취소", style: "cancel" },
              { text: "탈퇴", style: "destructive", onPress: () => leave(id) },
            ])} />
          ) : <Button loading={joinState.isLoading} title="클럽 가입" onPress={() => join(id)} />}
          <Text style={styles.section}>회원</Text>
          {detail.members.map((member) => (
            <Card key={member.id}>
              <View style={styles.row}><Text style={styles.member}>{member.name ?? member.email}</Text><Text style={styles.role}>{member.role}</Text></View>
              <Text style={styles.meta}>{member.division ?? "부서 미설정"}</Text>
            </Card>
          ))}
          <Text style={styles.section}>클럽 순위</Text>
          {ranking.data?.rankings.length ? ranking.data.rankings.slice(0, 20).map((row) => (
            <Card key={row.member_id}><View style={styles.row}><Text style={styles.member}>{row.rank}위 · {row.name}</Text><Text style={styles.rating}>{row.rating}</Text></View><Text style={styles.meta}>{row.wins}승 {row.losses}패 · 승률 {row.win_rate}%</Text></Card>
          )) : <Empty message="순위 정보가 없습니다." />}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { color: colors.text, fontSize: 22, fontWeight: "900" },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  desc: { color: colors.text, fontSize: 14, lineHeight: 21 },
  section: { color: colors.text, fontSize: 18, fontWeight: "900", marginTop: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  member: { color: colors.text, fontWeight: "800" },
  role: { color: "#4F46E5", fontWeight: "700", fontSize: 11 },
  rating: { color: colors.primary, fontWeight: "900" },
});
