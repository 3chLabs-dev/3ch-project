import { useNavigation } from "@react-navigation/native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useGetMyGroupsQuery, useGetMySportRankingsQuery } from "../api/mobileApi";
import { Screen } from "../components/Screen";
import { Card, Empty, Loading, PageHeader } from "../components/Ui";
import { colors } from "../theme";

export function RankingScreen() {
  const navigation = useNavigation<any>();
  const sports = useGetMySportRankingsQuery();
  const groups = useGetMyGroupsQuery();
  const loading = sports.isLoading || groups.isLoading;
  return <Screen refreshing={sports.isFetching || groups.isFetching} onRefresh={() => { sports.refetch(); groups.refetch(); }}><PageHeader title="순위" /><Card style={styles.intro}><Text style={styles.introTitle}>개인 통합 순위와 클럽 순위를 확인하세요</Text><Text style={styles.meta}>종목별 개인 순위는 여러 클럽의 경기 기록을 통합합니다.</Text></Card>{loading ? <Loading /> : null}<Text style={styles.heading}>종목별 개인 통합 순위</Text>{sports.data?.sports.length ? sports.data.sports.map((item) => <Pressable key={item.sport} onPress={() => navigation.navigate("SportRanking", { sport: item.sport })}><Card><View style={styles.row}><View><Text style={styles.title}>{item.sport}</Text><Text style={styles.meta}>참여 클럽 {item.club_count}곳 · 내 순위 {item.my_ranking?.rank ? `${item.my_ranking.rank}위` : "-"}</Text></View><Text style={styles.rating}>{item.my_ranking?.rating ?? "-"}</Text></View>{item.top3.map((row) => <Text key={row.member_id} style={styles.top}>{row.rank}위 {row.name} · {row.rating}</Text>)}</Card></Pressable>) : !loading ? <Empty message="아직 종목별 개인 순위가 없습니다." /> : null}<Text style={styles.heading}>가입한 클럽 순위</Text>{groups.data?.groups.map((group) => <Pressable key={group.id} onPress={() => navigation.navigate("ClubRanking", { groupId: group.club_code ?? group.id, title: group.name })}><Card><View style={styles.row}><Text style={styles.title}>{group.name}</Text><Text style={styles.meta}>{group.sport ?? "종목 미설정"} ›</Text></View></Card></Pressable>)}</Screen>;
}
const styles = StyleSheet.create({ intro: { backgroundColor: "#F5F5F5" }, introTitle: { color: colors.text, fontWeight: "900" }, heading: { color: colors.text, fontSize: 16, fontWeight: "900" }, row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, title: { color: colors.text, fontSize: 15, fontWeight: "900" }, meta: { color: colors.muted, fontSize: 11, lineHeight: 17 }, rating: { color: colors.primary, fontSize: 18, fontWeight: "900" }, top: { color: colors.muted, fontSize: 11 } });
