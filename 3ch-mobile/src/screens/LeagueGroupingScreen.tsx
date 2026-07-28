import { useRoute } from "@react-navigation/native";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { type Participant, useGetParticipantsQuery, useSaveGroupingMutation } from "../api/mobileApi";
import { Button, Card, Empty, Loading, PageHeader } from "../components/Ui";
import { Screen } from "../components/Screen";
import { colors } from "../theme";

type Row = Participant & { group_name: string; is_leader: boolean };
export function LeagueGroupingScreen() {
  const id = useRoute<any>().params.id as string; const query = useGetParticipantsQuery(id); const [save, state] = useSaveGroupingMutation(); const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => setRows((query.data?.participants ?? []).map((p) => ({ ...p, group_name: p.group_name ?? "", is_leader: Boolean(p.is_leader) }))), [query.data]);
  const update = (participantId: string, change: Partial<Row>) => setRows((previous) => previous.map((row) => row.id === participantId ? { ...row, ...change } : row));
  const submit = async () => { try { await save({ leagueId: id, groupings: rows.map((row) => ({ participant_id: row.id, group_name: row.group_name.trim(), is_leader: row.is_leader })) }).unwrap(); Alert.alert("저장 완료", "조 편성을 저장했습니다."); } catch (error: any) { Alert.alert("저장 실패", error?.data?.message ?? "다시 시도해 주세요."); } };
  return <Screen refreshing={query.isFetching} onRefresh={query.refetch}><PageHeader title="조 편성" /><Text style={styles.help}>참가자별 조와 조장 여부를 지정하세요.</Text>{query.isLoading ? <Loading /> : null}{rows.length ? rows.map((row) => <Card key={row.id} style={styles.card}><View style={styles.top}><Text style={styles.name}>{row.name}</Text><Pressable onPress={() => update(row.id, { is_leader: !row.is_leader })} style={[styles.leader, row.is_leader && styles.leaderOn]}><Text style={[styles.leaderText, row.is_leader && styles.leaderTextOn]}>{row.is_leader ? "조장" : "조원"}</Text></Pressable></View><TextInput value={row.group_name} onChangeText={(group_name) => update(row.id, { group_name })} placeholder="조 이름 (예: A조)" style={styles.input} /></Card>) : !query.isLoading ? <Empty message="참가자가 없습니다." /> : null}{rows.length ? <Button title="조 편성 저장" loading={state.isLoading} onPress={submit} /> : null}</Screen>;
}
const styles = StyleSheet.create({ help: { color: colors.muted, fontSize: 13, lineHeight: 19 }, card: { gap: 10 }, top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, name: { color: colors.text, fontWeight: "800", fontSize: 15 }, leader: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99, backgroundColor: "#F3F4F6" }, leaderOn: { backgroundColor: colors.primary }, leaderText: { color: colors.muted, fontSize: 11, fontWeight: "800" }, leaderTextOn: { color: "#FFFFFF" }, input: { minHeight: 42, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, color: colors.text } });
