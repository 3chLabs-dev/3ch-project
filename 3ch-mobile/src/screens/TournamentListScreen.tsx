import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useGetLeagueQuery, useGetMatchesQuery } from "../api/mobileApi";
import { Button, Card, Empty, Loading, PageHeader } from "../components/Ui";
import { Screen } from "../components/Screen";
import { colors } from "../theme";

const seedLabel: Record<string, string> = { manual: "수동", seed: "시드", random: "무작위", group: "조 분리", standings: "순위" };

export function TournamentListScreen() {
  const navigation = useNavigation<any>();
  const id = useRoute<any>().params.id as string;
  const leagueQuery = useGetLeagueQuery(id);
  const matchesQuery = useGetMatchesQuery(id);
  const league = leagueQuery.data?.league;
  const matches = matchesQuery.data?.matches ?? [];
  const hasTournament = matches.some((match) => match.bracket);
  const firstRound = matches.find((match) => match.bracket === "upper" && match.round_number === 1);
  return <Screen refreshing={leagueQuery.isFetching || matchesQuery.isFetching} onRefresh={() => { leagueQuery.refetch(); matchesQuery.refetch(); }}>
    <PageHeader title="토너먼트 대진표" />
    {leagueQuery.isLoading || matchesQuery.isLoading ? <Loading /> : null}
    {league ? <View style={styles.leagueMeta}><Tag label={league.start_date?.slice(0, 10) ?? "일정 미정"} /><Tag label={league.type ?? "리그"} />{league.rules ? <Tag label={league.rules} /> : null}</View> : null}
    {hasTournament && league ? <Card style={styles.tournamentCard}>
      <View style={styles.blueLine} />
      <View style={styles.body}><View style={styles.titleRow}><View style={styles.iconBox}><Ionicons name="git-network-outline" size={22} color={colors.primary} /></View><View><Text style={styles.title}>{league.type ?? "리그"} 토너먼트</Text><Text style={styles.date}>{league.start_date?.slice(0, 10) ?? "일정 미정"}</Text></View></View>
        <View style={styles.tags}>{firstRound?.match_label ? <Tag label={firstRound.match_label} tone="blue" /> : null}{league.tournament_advancement ? <Tag label={league.tournament_advancement === "upper-lower" ? "상위부 / 하위부" : "상위 진출"} tone="purple" /> : null}{league.tournament_seeding ? <Tag label={`배치: ${seedLabel[league.tournament_seeding] ?? league.tournament_seeding}`} tone="green" /> : null}</View>
        <View style={styles.actions}><Action title="경기 순서" outline onPress={() => navigation.navigate("TournamentMatchOrder", { id })} /><Action title="대진표 보기" onPress={() => navigation.navigate("TournamentBracket", { id })} /></View>
        <View style={styles.actions}><Action title="대진표 수정" muted onPress={() => navigation.navigate("TournamentSetup", { id })} /></View>
      </View>
    </Card> : <Card style={styles.emptyCard}><View style={styles.emptyIcon}><Ionicons name="git-network-outline" size={27} color="#94A3B8" /></View><Text style={styles.emptyTitle}>대진표가 없습니다.</Text><Text style={styles.emptyText}>토너먼트 대진표를 생성해 주세요.</Text><Button title="토너먼트 생성" onPress={() => navigation.navigate("TournamentSetup", { id })} /></Card>}
  </Screen>;
}
function Action({ title, onPress, outline, muted }: { title: string; onPress: () => void; outline?: boolean; muted?: boolean }) { return <Pressable onPress={onPress} style={[styles.action, outline && styles.outlineAction, muted && styles.mutedAction]}><Text style={[styles.actionText, outline && styles.outlineText, muted && styles.mutedText]}>{title}</Text><Ionicons name="chevron-forward" size={16} color={outline ? colors.primary : muted ? colors.muted : "#FFFFFF"} /></Pressable>; }
function Tag({ label, tone }: { label: string; tone?: "blue" | "purple" | "green" }) { return <View style={[styles.tag, tone === "blue" && styles.blueTag, tone === "purple" && styles.purpleTag, tone === "green" && styles.greenTag]}><Text style={[styles.tagText, tone === "blue" && styles.blueTagText, tone === "purple" && styles.purpleTagText, tone === "green" && styles.greenTagText]}>{label}</Text></View>; }
const styles = StyleSheet.create({ leagueMeta: { flexDirection: "row", gap: 6, flexWrap: "wrap" }, tag: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99, backgroundColor: "#F1F5F9" }, tagText: { color: "#475569", fontSize: 11, fontWeight: "700" }, blueTag: { backgroundColor: "#EFF6FF", borderWidth: 1, borderColor: "#BFDBFE" }, blueTagText: { color: "#2563EB" }, purpleTag: { backgroundColor: "#F5F3FF", borderWidth: 1, borderColor: "#DDD6FE" }, purpleTagText: { color: "#7C3AED" }, greenTag: { backgroundColor: "#F0FDF4", borderWidth: 1, borderColor: "#BBF7D0" }, greenTagText: { color: "#16A34A" }, tournamentCard: { overflow: "hidden", padding: 0, gap: 0 }, blueLine: { height: 4, backgroundColor: "#2563EB" }, body: { padding: 18, gap: 16 }, titleRow: { flexDirection: "row", alignItems: "center", gap: 12 }, iconBox: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: colors.blueSoft }, title: { color: colors.text, fontSize: 16, fontWeight: "900" }, date: { color: "#94A3B8", fontSize: 12, marginTop: 3 }, tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 }, actions: { flexDirection: "row", gap: 8 }, action: { flex: 1, minHeight: 43, borderRadius: 9, backgroundColor: "#2563EB", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 3 }, actionText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" }, outlineAction: { borderWidth: 1, borderColor: "#2563EB", backgroundColor: "#FFFFFF" }, outlineText: { color: "#2563EB" }, mutedAction: { borderWidth: 1, borderColor: "#E5E7EB", backgroundColor: "#FFFFFF" }, mutedText: { color: "#6B7280" }, emptyCard: { alignItems: "center", paddingVertical: 40, gap: 9, borderStyle: "dashed", borderWidth: 1.5, borderColor: "#E5E7EB" }, emptyIcon: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", backgroundColor: "#F1F5F9" }, emptyTitle: { color: "#374151", fontWeight: "800", fontSize: 15 }, emptyText: { color: "#9CA3AF", fontSize: 12, marginBottom: 6 } });
