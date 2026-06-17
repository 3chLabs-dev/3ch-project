import { useNavigation } from "@react-navigation/native";
import { Alert } from "react-native";
import { useState } from "react";
import { useGetMeQuery, useUpdateMeMutation } from "../api/mobileApi";
import { Screen } from "../components/Screen";
import { Button, Field, Loading, PageHeader } from "../components/Ui";
import { setUser } from "../store/authSlice";
import { useAppDispatch } from "../store/hooks";

export function ProfileEditScreen() {
  const navigation = useNavigation<any>(); const dispatch = useAppDispatch(); const me = useGetMeQuery(); const [update, state] = useUpdateMeMutation(); const [name, setName] = useState(""); const [password, setPassword] = useState("");
  if (me.isLoading) return <Screen><Loading /></Screen>;
  return <Screen><PageHeader title="정보수정" /><Field placeholder={me.data?.user.name ?? "이름"} value={name} onChangeText={setName} /><Field placeholder="새 비밀번호 (선택)" value={password} onChangeText={setPassword} secureTextEntry /><Button loading={state.isLoading} title="저장" onPress={async () => { try { await update({ ...(name ? { name } : {}), ...(password ? { password } : {}) }).unwrap(); const updated = await me.refetch().unwrap(); dispatch(setUser(updated.user)); Alert.alert("완료", "정보가 수정되었습니다."); navigation.goBack(); } catch { Alert.alert("실패", "정보 수정에 실패했습니다."); } }} /></Screen>;
}
