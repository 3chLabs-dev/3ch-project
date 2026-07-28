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
  const tabs = useMemo(() => [...new Map(matches.map((m) => [`${m.bracket ?? "upper"}-${m.round_number ?? 0}`, m])).entries()].map(([key, m]) => ({ key, bracket: m.bracket ?? "upper", round: m.round_number ?? 0, label: m.match_label ?? `${m.bracket === "lower" ? "\ud558\uc704" : "\uc0c1\uc704"} R${m.round_number}` })), [matches]);
  const currentKey = selectedKey ?? tabs[0]?.key;
  const currentMatches = matches.filter((m) => `${m.bracket ?? "upper"}-${m.round_number ?? 0}` === currentKey);
  const manual = leagueQuery.data?.league.tournament_seeding === "manual";

  const assign = async (participantId: string | null) => {
    if (!slotTarget) return;
    try {
      await updateMatch({ leagueId: id, matchId: slotTarget.match.id, updates: { [slotTarget.slot]: participantId } }).unwrap();
      setSlotTarget(null);
    } catch (error: any) { Alert.alert("\ubc30\uc815 \uc2e4\ud328", error?.data?.message ?? "\ucc38\uac00\uc790 \ubc30\uc815\uc744 \ubcc0\uacbd\ud558\uc9c0 \ubabb\ud588\uc2b5\ub2c8\ub2e4."); }
  };
  const setCourt = async (match: LeagueMatch, court: string) => {
    try { await updateMatch({ leagueId: id, matchId: match.id, updates: { court: court.trim() || null } }).unwrap(); }
    catch (error: any) { Alert.alert("\ucf54\ud2b8 \uc800\uc7a5 \uc2e4\ud328", error?.data?.message ?? "\ub2e4\uc2dc \uc2dc\ub3c4\ud574 \uc8fc\uc138\uc694."); }
  };
  const setStatus = async (match: LeagueMatch) => {
    const next = match.status === "pending" ? "playing" : match.status === "playing" ? "done" : "done";
    if (match.status === "done") return;
    try { await updateMatch({ leagueId: id, matchId: match.id, updates: { status: next } }).unwrap(); }
    catch (error: any) { Alert.alert("\uc0c1\ud0dc \ubcc0\uacbd \uc2e4\ud328", error?.data?.message ?? "\ub2e4\uc2dc \uc2dc\ub3c4\ud574 \uc8fc\uc138\uc694."); }
  };
  const move = async (match: LeagueMatch, direction: -1 | 1) => {
    const index = matches.findIndex((m) => m.id === match.id);
    const neighbor = currentMatches[currentMatches.findIndex((m) => m.id === match.id) + direction];
    if (index < 0 || !neighbor) return;
    const next = [...matches];
    const neighborIndex = next.findIndex((m) => m.id === neighbor.id);
    [next[index], next[neighborIndex]] = [next[neighborIndex], next[index]];
    try { await reorderMatches({ leagueId: id, order: next.map((m) => m.id) }).unwrap(); }
    catch (error: any) { Alert.alert("\uc21c\uc11c \ubcc0\uacbd \uc2e4\ud328", error?.data?.message ?? "\ub2e4\uc2dc \uc2dc\ub3c4\ud574 \uc8fc\uc138\uc694."); }
  };

  return <Screen refreshing={matchesQuery.isFetching} onRefresh={() => { matchesQuery.refetch(); participantsQuery.refetch(); }}>
    <PageHeader title="\uacbd\uae30 \uc6b4\uc601" />
    {matchesQuery.isLoading ? <Loading /> : null}
    {tabs.length ? <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>{tabs.map((tab) => <Pressable key={tab.key} onPress={() => setSelectedKey(tab.key)} style={[styles.tab, currentKey === tab.key && styles.tabActive, tab.bracket === "lower" && styles.lowerTab]}><Text style={[styles.tabText, currentKey === tab.key && styles.tabTextActive]}>{tab.label}</Text></Pressable>)}</ScrollView>
      {manual && <Card style={styles.notice}><Text style={styles.noticeText}>\uc218\ub3d9 \uc2dc\ub4dc: \ucc38\uac00\uc790 \uc2ac\ub86f\uc744 \ub20c\ub7ec \ub300\uc9c4\uc5d0 \uc9c1\uc811 \ubc30\uc815\ud558\uc138\uc694.</Text></Card>}
      {currentMatches.map((match, index) => <MatchManagementCard key={match.id} match={match} index={index} total={currentMatches.length} manual={manual} busy={reorderState.isLoading} onAssign={(slot) => setSlotTarget({ match, slot })} onCourt={setCourt} onStatus={setStatus} onMove={(direction) => move(match, direction)} />)}
    </> : <Empty message="\uc6b4\uc601\ud560 \ub300\uc9c4 \uacbd\uae30\uac00 \uc5c6\uc2b5\ub2c8\ub2e4." />}
    <Modal visible={!!slotTarget} transparent animationType="slide" onRequestClose={() => setSlotTarget(null)}><View style={styles.backdrop}><View style={styles.sheet}><Text style={styles.sheetTitle}>\ucc38\uac00\uc790 \ubc30\uc815</Text><Pressable onPress={() => assign(null)} style={styles.participant}><Text style={styles.clearText}>\uc2ac\ub86f \ube44\uc6b0\uae30</Text></Pressable><ScrollView>{(participantsQuery.data?.participants ?? []).map((participant) => <Pressable key={participant.id} onPress={() => assign(participant.id)} style={styles.participant}><Text style={styles.participantName}>{participant.name}</Text><Text style={styles.division}>{participant.division ?? ""}</Text></Pressable>)}</ScrollView><Button title="\ub2eb\uae30" onPress={() => setSlotTarget(null)} /></View></View></Modal>
  </Screen>;
}

function MatchManagementCard({ match, index, total, manual, busy, onAssign, onCourt, onStatus, onMove }: { match: LeagueMatch; index: number; total: number; manual: boolean; busy: boolean; onAssign: (slot: Slot) => void; onCourt: (match: LeagueMatch, court: string) => void; onStatus: (match: LeagueMatch) => void; onMove: (direction: -1 | 1) => void }) {
  const [court, setCourt] = useState(match.court ?? "");
  const canAssign = manual && match.round_number === 1 && match.bracket !== "lower";
  return <Card style={styles.match}><View style={styles.matchHeader}><Text style={styles.matchTitle}>{match.match_order}\ubc88 \uacbd\uae30</Text><View style={styles.orderButtons}><Pressable disabled={index === 0 || busy} onPress={() => onMove(-1)} style={styles.orderButton}><Text>\u25b2</Text></Pressable><Pressable disabled={index === total - 1 || busy} onPress={() => onMove(1)} style={styles.orderButton}><Text>\u25bc</Text></Pressable></View></View>
    <Slot name={match.participant_a_name} score={match.score_a} editable={canAssign} onPress={() => onAssign("participant_a_id")} /><View style={styles.vs}><Text style={styles.vsText}>VS</Text></View><Slot name={match.participant_b_name} score={match.score_b} editable={canAssign} onPress={() => onAssign("participant_b_id")} />
    <View style={styles.courtRow}><TextInput value={court} onChangeText={setCourt} onBlur={() => onCourt(match, court)} placeholder="\ucf54\ud2b8\uba85 (\uc608: A-1)" style={styles.courtInput} /><Pressable onPress={() => onCourt(match, court)} style={styles.saveCourt}><Text style={styles.saveCourtText}>\uc800\uc7a5</Text></Pressable></View>
    <Pressable disabled={match.status === "done"} onPress={() => onStatus(match)} style={[styles.statusButton, match.status === "done" && styles.statusDisabled]}><Text style={styles.statusButtonText}>{match.status === "pending" ? "\uacbd\uae30 \uc2dc\uc791" : match.status === "playing" ? "\uacbd\uae30 \uc885\ub8cc" : "\uc885\ub8cc\ub428"}</Text></Pressable>
  </Card>;
}
function Slot({ name, score, editable, onPress }: { name?: string | null; score?: number | null; editable: boolean; onPress: () => void }) { return <Pressable disabled={!editable} onPress={onPress} style={[styles.slot, editable && styles.slotEditable]}><Text style={styles.slotName}>{name ?? (editable ? "\ucc38\uac00\uc790 \uc120\ud0dd" : "\ubbf8\uc815")}</Text><Text style={styles.slotScore}>{score ?? "-"}</Text></Pressable>; }
const styles = StyleSheet.create({ tabs: { gap: 8, paddingBottom: 4 }, tab: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 999, backgroundColor: "#EEF2F7" }, lowerTab: { backgroundColor: "#F5F3FF" }, tabActive: { backgroundColor: colors.primary }, tabText: { color: colors.text, fontWeight: "800", fontSize: 12 }, tabTextActive: { color: "#FFFFFF" }, notice: { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE", borderWidth: 1 }, noticeText: { color: "#1D4ED8", fontSize: 13, fontWeight: "700" }, match: { gap: 10, padding: 14 }, matchHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, matchTitle: { color: colors.text, fontSize: 15, fontWeight: "900" }, orderButtons: { flexDirection: "row", gap: 6 }, orderButton: { width: 32, height: 30, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 7 }, slot: { minHeight: 42, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: "#FAFAFA" }, slotEditable: { borderColor: colors.primary, backgroundColor: colors.blueSoft }, slotName: { color: colors.text, fontWeight: "800" }, slotScore: { color: colors.primary, fontWeight: "900", fontSize: 17 }, vs: { alignItems: "center" }, vsText: { color: colors.muted, fontSize: 11, fontWeight: "900" }, courtRow: { flexDirection: "row", gap: 8 }, courtInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 11, minHeight: 42, color: colors.text }, saveCourt: { justifyContent: "center", paddingHorizontal: 13, borderRadius: 8, backgroundColor: "#EEF2F7" }, saveCourtText: { color: colors.text, fontWeight: "800" }, statusButton: { minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: colors.primary }, statusDisabled: { backgroundColor: colors.muted }, statusButtonText: { color: "#FFFFFF", fontWeight: "800" }, backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" }, sheet: { maxHeight: "75%", padding: 20, gap: 10, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: "#FFFFFF" }, sheetTitle: { color: colors.text, fontSize: 18, fontWeight: "900" }, participant: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.border }, participantName: { color: colors.text, fontSize: 15, fontWeight: "700" }, division: { color: colors.muted, fontSize: 12 }, clearText: { color: colors.danger, fontWeight: "800" } });
