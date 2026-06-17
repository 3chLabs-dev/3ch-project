import { useNavigation } from "@react-navigation/native";
import { useState } from "react";
import { useCreateGroupMutation } from "../api/mobileApi";
import { Screen } from "../components/Screen";
import { Button, Field, PageHeader } from "../components/Ui";

export function GroupCreateScreen() {
  const navigation = useNavigation<any>();
  const [create, state] = useCreateGroupMutation();
  const [name, setName] = useState("");
  const [sport, setSport] = useState("");
  const [region, setRegion] = useState("");
  const [description, setDescription] = useState("");
  return <Screen><PageHeader title="클럽 생성" />
    <Field value={name} onChangeText={setName} placeholder="클럽 이름" />
    <Field value={sport} onChangeText={setSport} placeholder="종목 (예: 탁구)" />
    <Field value={region} onChangeText={setRegion} placeholder="지역 (예: 서울)" />
    <Field value={description} onChangeText={setDescription} placeholder="클럽 소개" multiline />
    <Button loading={state.isLoading} title="클럽 생성" onPress={async () => { const result = await create({ name, sport, region_city: region, description }).unwrap(); navigation.replace("GroupDetail", { id: result.group.id }); }} />
  </Screen>;
}
