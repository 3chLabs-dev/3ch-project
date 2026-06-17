import { useNavigation, useRoute } from "@react-navigation/native";
import { useState } from "react";
import { useCreateLeagueMutation } from "../api/mobileApi";
import { Screen } from "../components/Screen";
import { Button, Field, PageHeader } from "../components/Ui";

export function LeagueCreateScreen() {
  const navigation = useNavigation<any>(); const groupId = useRoute<any>().params?.groupId;
  const [create, state] = useCreateLeagueMutation(); const [name, setName] = useState(""); const [sport, setSport] = useState("탁구"); const [type, setType] = useState("단식"); const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  return <Screen><PageHeader title="리그 생성" /><Field placeholder="리그 이름" value={name} onChangeText={setName} /><Field placeholder="종목" value={sport} onChangeText={setSport} /><Field placeholder="유형" value={type} onChangeText={setType} /><Field placeholder="YYYY-MM-DD" value={date} onChangeText={setDate} /><Button loading={state.isLoading} title="리그 생성" onPress={async () => { const result = await create({ name, title: name, sport, type, start_date: new Date(date).toISOString(), group_id: groupId }).unwrap(); navigation.replace("LeagueDetail", { id: result.league.id }); }} /></Screen>;
}
