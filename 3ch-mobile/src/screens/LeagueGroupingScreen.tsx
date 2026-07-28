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
  const submit = async () => { try { await save({ leagueId: id, groupings: rows.map((row) => ({ participant_id: row.id, group_name: row.group_name.trim(), is_leader: row.is_leader })) }).unwrap(); Alert.alert("\uc800\uc7a5 \uc644\ub8cc", "\uc870 \ud3b8\uc131\uc744 \uc800\uc7a5\ud588\uc2b5\ub2c8\ub2e4."); } catch (error: any) { Alert.alert("\uc800\uc7a5 \uc2e4\ud328", error?.data?.message ?? "\ub2e4\uc2dc \uc2dc\ub3c4\ud574 \uc8fc\uc138\uc694."); } };
  return <Screen refreshing={query.isFetching} onRefresh={query.refetch}><PageHeader title="\uc870 \ud3b8\uc131" /><Text style={styles.help}>\ucc38\uac00\uc790\ubcc4 \uc870\uc640 \uc870\uc7a5 \uc5ec\ubd80\ub97c \uc9c0\uc815\ud558\uc138\uc694.</Text>{query.isLoading ? <Loading /> : null}{rows.length ? rows.map((row) => <Card key={row.id} style={styles.card}><View style={styles.top}><Text style={styles.name}>{row.name}</Text><Pressable onPress={() => update(row.id, { is_leader: !row.is_leader })} style={[styles.leader, row.is_leader && styles.leaderOn]}><Text style={[styles.leaderText, row.is_leader && styles.leaderTextOn]}>{row.is_leader ? "\uc870\uc7a5" : "\uc870\uc6d0"}</Text></Pressable></View><TextInput value={row.group_name} onChangeText={(group_name) => update(row.id, { group_name })} placeholder="\uc870 \uc774\ub984 (\uc608: A\uc870)" style={styles.input} /></Card>) : !query.isLoading ? <Empty message="\ucc38\uac00\uc790\uac00 \uc5c6\uc2b5\ub2c8\ub2e4." /> : null}{rows.length ? <Button title="\uc870 \ud3b8\uc131 \uc800\uc7a5" loading={state.isLoading} onPress={submit} /> : null}</Screen>;
}
const styles = StyleSheet.create({ help: { color: colors.muted, fontSize: 13, lineHeight: 19 }, card: { gap: 10 }, top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, name: { color: colors.text, fontWeight: "800", fontSize: 15 }, leader: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99, backgroundColor: "#F3F4F6" }, leaderOn: { backgroundColor: colors.primary }, leaderText: { color: colors.muted, fontSize: 11, fontWeight: "800" }, leaderTextOn: { color: "#FFFFFF" }, input: { minHeight: 42, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, color: colors.text } });
