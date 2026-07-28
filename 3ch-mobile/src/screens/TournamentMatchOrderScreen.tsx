import { useNavigation, useRoute } from "@react-navigation/native";
import { useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { type LeagueMatch, useGetLeagueQuery, useGetMatchesQuery, useGetParticipantsQuery, useReorderMatchesMutation, useUpdateMatchMutation } from "../api/mobileApi";
import { Button, Card, Empty, Loading, PageHeader } from "../components/Ui";
import { Screen } from "../components/Screen";
import { colors } from "../theme";

type Slot = "participant_a_id" | "participant_b_id";

export function TournamentMatchOrderScreen() {
  const navigation = useNavigation<any>();
  const id = useRoute<any>().params.id as string;
  const matchesQuery = useGetMatchesQuery(id);
  const participantsQuery = useGetParticipantsQuery(id);
  const leagueQuery = useGetLeagueQuery(id);
  const [updateMatch] = useUpdateMatchMutation();
  const [reorderMatches, reorderState] = useReorderMatchesMutation();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [slotTarget, setSlotTarget] = useState<{ match: LeagueMatch; slot: Slot } | null>(null);
  const matches = useMemo(() => (matchesQuery.data?.matches ?? []).filter((match) => match.bracket).sort((a, b) => a.match_order - b.match_order), [matchesQuery.data]);
  const tabs = useMemo(() => [...new Map(matches.map((m) => [`${m.bracket ?? "upper"}-${m.round_number ?? 0}`, m])).entries()].map(([key, m]) => ({ key, bracket: m.bracket ?? "upper", round: m.round_number ?? 0, label: m.match_label ?? `${m.bracket === "lower" ? "하위" : "상위"} R${m.round_number}` })), [matches]);
  const currentKey = selectedKey ?? tabs[0]?.key;
  const currentMatches = matches.filter((m) => `${m.bracket ?? "upper"}-${m.round_number ?? 0}` === currentKey);
  const manual = leagueQuery.data?.league.tournament_seeding === "manual";

  const assign = async (participantId: string | null) => {
    if (!slotTarget) return;
    try {
      await updateMatch({ leagueId: id, matchId: slotTarget.match.id, updates: { [slotTarget.slot]: participantId } }).unwrap();
      setSlotTarget(null);
    } catch (error: any) { Alert.alert("배정 실패", error?.data?.message ?? "참가자 배정을 변경하지 못했습니다."); }
  };
  const setCourt = async (match: LeagueMatch, court: string) => {
    try { await updateMatch({ leagueId: id, matchId: match.id, updates: { court: court.trim() || null } }).unwrap(); }
    catch (error: any) { Alert.alert("코트 저장 실패", error?.data?.message ?? "다시 시도해 주세요."); }
  };
  const setStatus = async (match: LeagueMatch) => {
    const next = match.status === "pending" ? "playing" : match.status === "playing" ? "done" : "done";
    if (match.status === "done") return;
    try { await updateMatch({ leagueId: id, matchId: match.id, updates: { status: next } }).unwrap(); }
    catch (error: any) { Alert.alert("상태 변경 실패", error?.data?.message ?? "다시 시도해 주세요."); }
  };
  const move = async (match: LeagueMatch, direction: -1 | 1) => {
    const index = matches.findIndex((m) => m.id === match.id);
    const neighbor = currentMatches[currentMatches.findIndex((m) => m.id === match.id) + direction];
    if (index < 0 || !neighbor) return;
    const next = [...matches];
    const neighborIndex = next.findIndex((m) => m.id === neighbor.id);
    [next[index], next[neighborIndex]] = [next[neighborIndex], next[index]];
    try { await reorderMatches({ leagueId: id, order: next.map((m) => m.id) }).unwrap(); }
    catch (error: any) { Alert.alert("순서 변경 실패", error?.data?.message ?? "다시 시도해 주세요."); }
  };

  return <Screen refreshing={matchesQuery.isFetching} onRefresh={() => { matchesQuery.refetch(); participantsQuery.refetch(); }}>
    <PageHeader title="경기 운영" />
    {matchesQuery.isLoading ? <Loading /> : null}
    {tabs.length ? <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>{tabs.map((tab) => <Pressable key={tab.key} onPress={() => setSelectedKey(tab.key)} style={[styles.tab, currentKey === tab.key && styles.tabActive, tab.bracket === "lower" && styles.lowerTab]}><Text style={[styles.tabText, currentKey === tab.key && styles.tabTextActive]}>{tab.label}</Text></Pressable>)}</ScrollView>
      {manual && <Card style={styles.notice}><Text style={styles.noticeText}>수동 시드: 참가자 슬롯을 눌러 대진에 직접 배정하세요.</Text></Card>}
      {currentMatches.map((match, index) => <MatchManagementCard key={match.id} match={match} index={index} total={currentMatches.length} manual={manual} busy={reorderState.isLoading} onAssign={(slot) => setSlotTarget({ match, slot })} onCourt={setCourt} onStatus={setStatus} onMove={(direction) => move(match, direction)} />)}
    </> : <Empty message="운영할 대진 경기가 없습니다." />}
    <Modal visible={!!slotTarget} transparent animationType="slide" onRequestClose={() => setSlotTarget(null)}><View style={styles.backdrop}><View style={styles.sheet}><Text style={styles.sheetTitle}>참가자 배정</Text><Pressable onPress={() => assign(null)} style={styles.participant}><Text style={styles.clearText}>슬롯 비우기</Text></Pressable><ScrollView>{(participantsQuery.data?.participants ?? []).map((participant) => <Pressable key={participant.id} onPress={() => assign(participant.id)} style={styles.participant}><Text style={styles.participantName}>{participant.name}</Text><Text style={styles.division}>{participant.division ?? ""}</Text></Pressable>)}</ScrollView><Button title="닫기" onPress={() => setSlotTarget(null)} /></View></View></Modal>
  </Screen>;
}

function MatchManagementCard({ match, index, total, manual, busy, onAssign, onCourt, onStatus, onMove }: { match: LeagueMatch; index: number; total: number; manual: boolean; busy: boolean; onAssign: (slot: Slot) => void; onCourt: (match: LeagueMatch, court: string) => void; onStatus: (match: LeagueMatch) => void; onMove: (direction: -1 | 1) => void }) {
  const [court, setCourt] = useState(match.court ?? "");
  const canAssign = manual && match.round_number === 1 && match.bracket !== "lower";
  return <Card style={styles.match}><View style={styles.matchHeader}><Text style={styles.matchTitle}>{match.match_order}번 경기</Text><View style={styles.orderButtons}><Pressable disabled={index === 0 || busy} onPress={() => onMove(-1)} style={styles.orderButton}><Text>▲</Text></Pressable><Pressable disabled={index === total - 1 || busy} onPress={() => onMove(1)} style={styles.orderButton}><Text>▼</Text></Pressable></View></View>
    <Slot name={match.participant_a_name} score={match.score_a} editable={canAssign} onPress={() => onAssign("participant_a_id")} /><View style={styles.vs}><Text style={styles.vsText}>VS</Text></View><Slot name={match.participant_b_name} score={match.score_b} editable={canAssign} onPress={() => onAssign("participant_b_id")} />
    <View style={styles.courtRow}><TextInput value={court} onChangeText={setCourt} onBlur={() => onCourt(match, court)} placeholder="코트명 (예: A-1)" style={styles.courtInput} /><Pressable onPress={() => onCourt(match, court)} style={styles.saveCourt}><Text style={styles.saveCourtText}>저장</Text></Pressable></View>
    <Pressable disabled={match.status === "done"} onPress={() => onStatus(match)} style={[styles.statusButton, match.status === "done" && styles.statusDisabled]}><Text style={styles.statusButtonText}>{match.status === "pending" ? "경기 시작" : match.status === "playing" ? "경기 종료" : "종료됨"}</Text></Pressable>
  </Card>;
}
function Slot({ name, score, editable, onPress }: { name?: string | null; score?: number | null; editable: boolean; onPress: () => void }) { return <Pressable disabled={!editable} onPress={onPress} style={[styles.slot, editable && styles.slotEditable]}><Text style={styles.slotName}>{name ?? (editable ? "참가자 선택" : "미정")}</Text><Text style={styles.slotScore}>{score ?? "-"}</Text></Pressable>; }
const styles = StyleSheet.create({ tabs: { gap: 8, paddingBottom: 4 }, tab: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 999, backgroundColor: "#EEF2F7" }, lowerTab: { backgroundColor: "#F5F3FF" }, tabActive: { backgroundColor: colors.primary }, tabText: { color: colors.text, fontWeight: "800", fontSize: 12 }, tabTextActive: { color: "#FFFFFF" }, notice: { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE", borderWidth: 1 }, noticeText: { color: "#1D4ED8", fontSize: 13, fontWeight: "700" }, match: { gap: 10, padding: 14 }, matchHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, matchTitle: { color: colors.text, fontSize: 15, fontWeight: "900" }, orderButtons: { flexDirection: "row", gap: 6 }, orderButton: { width: 32, height: 30, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 7 }, slot: { minHeight: 42, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: "#FAFAFA" }, slotEditable: { borderColor: colors.primary, backgroundColor: colors.blueSoft }, slotName: { color: colors.text, fontWeight: "800" }, slotScore: { color: colors.primary, fontWeight: "900", fontSize: 17 }, vs: { alignItems: "center" }, vsText: { color: colors.muted, fontSize: 11, fontWeight: "900" }, courtRow: { flexDirection: "row", gap: 8 }, courtInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 11, minHeight: 42, color: colors.text }, saveCourt: { justifyContent: "center", paddingHorizontal: 13, borderRadius: 8, backgroundColor: "#EEF2F7" }, saveCourtText: { color: colors.text, fontWeight: "800" }, statusButton: { minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: colors.primary }, statusDisabled: { backgroundColor: colors.muted }, statusButtonText: { color: "#FFFFFF", fontWeight: "800" }, backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" }, sheet: { maxHeight: "75%", padding: 20, gap: 10, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: "#FFFFFF" }, sheetTitle: { color: colors.text, fontSize: 18, fontWeight: "900" }, participant: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.border }, participantName: { color: colors.text, fontSize: 15, fontWeight: "700" }, division: { color: colors.muted, fontSize: 12 }, clearText: { color: colors.danger, fontWeight: "800" } });
