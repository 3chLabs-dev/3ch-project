import { useNavigation, useRoute } from "@react-navigation/native";
import { useState } from "react";
import { Alert, Text } from "react-native";
import { useCreateDrawMutation } from "../api/mobileApi";
import { Button, Card, Field, PageHeader } from "../components/Ui";
import { Screen } from "../components/Screen";

/** Compact, touch-friendly draft creation. Winners are selected in the web-compatible draw result flow. */
export function DrawCreateScreen() {
  const navigation = useNavigation<any>();
  const leagueId = useRoute<any>().params.leagueId as string;
  const [create, state] = useCreateDrawMutation();
  const [name, setName] = useState(""); const [prize, setPrize] = useState(""); const [quantity, setQuantity] = useState("1");
  const submit = async () => {
    const count = Number(quantity);
    if (!name.trim() || !prize.trim() || !Number.isInteger(count) || count < 1) { Alert.alert("입력 확인", "추첨명, 경품명, 수량을 올바르게 입력해 주세요."); return; }
    try { const result = await create({ leagueId, name: name.trim(), prizes: [{ prize_name: prize.trim(), quantity: count }] }).unwrap(); navigation.replace("DrawDetail", { leagueId, drawId: result.draw_id }); }
    catch (error: any) { Alert.alert("생성하지 못했습니다", error?.data?.message ?? "잠시 후 다시 시도해 주세요."); }
  };
  return <Screen><PageHeader title="추첨 만들기" /><Card><Text>한 번에 가장 중요한 경품부터 만들고, 결과 화면에서 당첨자를 확인하세요.</Text><Field value={name} onChangeText={setName} placeholder="추첨 이름" /><Field value={prize} onChangeText={setPrize} placeholder="경품 이름" /><Field value={quantity} onChangeText={setQuantity} placeholder="수량" keyboardType="number-pad" /><Button title="추첨 생성" loading={state.isLoading} onPress={submit} /></Card></Screen>;
}
