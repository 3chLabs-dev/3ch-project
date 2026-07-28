import { useNavigation, useRoute } from "@react-navigation/native";
import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useGetLeagueQuery, useGetMatchesQuery, useGetParticipantsQuery, useInitTournamentMutation, useUpdateLeagueMutation } from "../api/mobileApi";
import { Button, Card, Field, Loading, PageHeader } from "../components/Ui";
import { Screen } from "../components/Screen";
import { colors } from "../theme";

const SIZES = [4, 8, 16, 32, 64, 128];
const SEEDING = [["seed", "시드(등록 순서)"], ["random", "무작위"], ["manual", "수동"], ["group", "조 분리"], ["standings", "시드(순위)"]] as const;
type Seeding = "seed" | "random" | "manual" | "group" | "standings";

export function TournamentSetupScreen() {
  const navigation = useNavigation<any>();
  const id = useRoute<any>().params.id as string;
  const participantsQuery = useGetParticipantsQuery(id);
  const leagueQuery = useGetLeagueQuery(id);
  const matchesQuery = useGetMatchesQuery(id);
  const [initTournament, state] = useInitTournamentMutation();
  const [updateLeague] = useUpdateLeagueMutation();
  const participantCount = participantsQuery.data?.participants.length ?? 0;
  const suggestedSize = useMemo(() => SIZES.find((item) => item >= Math.max(participantCount, 4)) ?? 128, [participantCount]);
  const [size, setSize] = useState<number | null>(null);
  const [seeding, setSeeding] = useState<Seeding>(leagueQuery.data?.league.tournament_seeding as Seeding ?? "seed");
  const [advancement, setAdvancement] = useState<"upper-only" | "upper-lower">(leagueQuery.data?.league.tournament_advancement === "upper-lower" ? "upper-lower" : "upper-only");
  const [rules, setRules] = useState(leagueQuery.data?.league.tournament_rules ?? "5전 3선승제");
  const bracketSize = size ?? suggestedSize;
  const hasTournament = (matchesQuery.data?.matches ?? []).some((match) => match.bracket);
  const saveAndCreate = async (force = false) => {
    if (participantCount < 2 && seeding !== "manual") { Alert.alert("참가자 필요", "대진표를 생성하려면 참가자를 2명 이상 등록해 주세요."); return; }
    try {
      await updateLeague({ leagueId: id, updates: { tournament_rules: rules.trim() } }).unwrap();
      await initTournament({ leagueId: id, bracket_size: bracketSize, seeding, advancement, force }).unwrap();
      navigation.replace("TournamentList", { id });
    } catch (error: any) { Alert.alert("대진표 생성 실패", error?.data?.message ?? "다시 시도해 주세요."); }
  };
  const create = () => {
    if (!hasTournament) { saveAndCreate(); return; }
    Alert.alert("대진표 재생성", "기존 대진과 경기 기록이 초기화됩니다.", [{ text: "취소", style: "cancel" }, { text: "재생성", style: "destructive", onPress: () => saveAndCreate(true) }]);
  };
  return <Screen maxWidth={720} refreshing={participantsQuery.isFetching || matchesQuery.isFetching} onRefresh={() => { participantsQuery.refetch(); matchesQuery.refetch(); leagueQuery.refetch(); }}>
    <PageHeader title="토너먼트 대진표 생성" />
    {participantsQuery.isLoading ? <Loading /> : null}
    <View style={styles.content}>
      <Section title="토너먼트 유형"><View style={styles.options}><Choice label="단일 토너먼트" description="하나의 대진표로 운영합니다." active={advancement === "upper-only"} onPress={() => setAdvancement("upper-only")} /><Choice label="상위부 / 하위부" description="1라운드 승자는 상위부, 패자는 하위부로 진출합니다." active={advancement === "upper-lower"} onPress={() => setAdvancement("upper-lower")} /></View></Section>
      <Section title="본선 시작 단계"><View style={styles.chips}>{SIZES.map((item) => <Chip key={item} label={`${item}강`} active={bracketSize === item} onPress={() => setSize(item)} />)}</View><Text style={styles.help}>참가 인원이 부족한 경기는 부전승으로 처리됩니다.</Text></Section>
      <Section title="배치 방식"><View style={styles.chips}>{SEEDING.map(([value, label]) => <Chip key={value} label={label} active={seeding === value} onPress={() => setSeeding(value)} />)}</View><Text style={styles.help}>{seeding === "manual" ? "관리자가 1라운드 슬롯에 참가자를 직접 배정합니다." : "선택한 기준에 따라 참가자를 자동 배치합니다."}</Text></Section>
      <Section title="본선 규칙"><Field value={rules} onChangeText={setRules} placeholder="예: 5전 3선승제" /></Section>
      <Card style={styles.summary}><Text style={styles.summaryTitle}>참가자 {participantCount}명 · {bracketSize}강 대진</Text><Text style={styles.help}>생성 후 경기 순서 화면에서 코트, 순서, 수동 시드를 운영할 수 있습니다.</Text></Card>
      <Button title={hasTournament ? "대진표 재생성" : "완료"} loading={state.isLoading} onPress={create} />
    </View>
  </Screen>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) { return <View style={styles.section}><Text style={styles.label}>{title}</Text>{children}</View>; }
function Choice({ label, description, active, onPress }: { label: string; description: string; active: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.choice, active && styles.choiceActive]}><Text style={[styles.choiceTitle, active && styles.choiceTitleActive]}>{label}</Text><Text style={styles.choiceDescription}>{description}</Text></Pressable>; }
function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>; }
const styles = StyleSheet.create({ content: { gap: 24 }, section: { gap: 10 }, label: { color: colors.text, fontWeight: "800", fontSize: 14 }, options: { flexDirection: "row", gap: 10 }, choice: { flex: 1, minHeight: 104, padding: 13, gap: 6, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface }, choiceActive: { borderColor: colors.primary, backgroundColor: colors.blueSoft }, choiceTitle: { color: colors.text, fontWeight: "800", fontSize: 13 }, choiceTitleActive: { color: colors.primary }, choiceDescription: { color: colors.muted, fontSize: 11, lineHeight: 16 }, chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, chip: { backgroundColor: "#F3F4F6", borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9 }, chipActive: { backgroundColor: colors.primary }, chipText: { color: "#374151", fontWeight: "800", fontSize: 12 }, chipTextActive: { color: "#FFFFFF" }, help: { color: colors.muted, fontSize: 12, lineHeight: 18 }, summary: { backgroundColor: "#F8FAFC", gap: 5 }, summaryTitle: { color: colors.text, fontSize: 14, fontWeight: "900" } });
