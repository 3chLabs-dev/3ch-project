import { useRoute } from "@react-navigation/native";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAddParticipantsMutation, useGetParticipantsQuery, useUpdateParticipantMutation } from "../api/mobileApi";
import { Screen } from "../components/Screen";
import { Button, Card, Empty, Field, PageHeader } from "../components/Ui";
import { colors } from "../theme";

export function ParticipantsScreen() {
  const id = useRoute<any>().params.id as string;
  const query = useGetParticipantsQuery(id);
  const [add, addState] = useAddParticipantsMutation();
  const [update] = useUpdateParticipantMutation();
  const [name, setName] = useState("");
  const [division, setDivision] = useState("");
  return <Screen refreshing={query.isFetching} onRefresh={query.refetch}><PageHeader title="참가자 관리" />
    <Card><Field placeholder="참가자 이름" value={name} onChangeText={setName} /><Field placeholder="부서/조" value={division} onChangeText={setDivision} /><Button loading={addState.isLoading} title="참가자 추가" onPress={async () => { await add({ leagueId: id, participants: [{ name, division }] }); setName(""); setDivision(""); }} /></Card>
    {query.data?.participants.length ? query.data.participants.map((p) => <Card key={p.id}>
      <View style={styles.row}><View style={styles.grow}><Text style={styles.name}>{p.name}</Text><Text style={styles.meta}>{p.division ?? "미배정"}</Text></View><Button title={p.arrived ? "도착 완료" : "도착 처리"} onPress={() => update({ leagueId: id, participantId: p.id, updates: { arrived: !p.arrived } })} /></View>
    </Card>) : <Empty message="참가자가 없습니다." />}
  </Screen>;
}
const styles = StyleSheet.create({ row: { flexDirection: "row", alignItems: "center", gap: 10 }, grow: { flex: 1 }, name: { color: colors.text, fontWeight: "800" }, meta: { color: colors.muted, fontSize: 12 } });
