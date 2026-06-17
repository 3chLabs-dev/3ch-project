import { useNavigation } from "@react-navigation/native";
import { Alert } from "react-native";
import { useState } from "react";
import { useRegisterMutation } from "../api/mobileApi";
import { Screen } from "../components/Screen";
import { Button, Field, PageHeader } from "../components/Ui";

export function SignUpScreen() {
  const navigation = useNavigation<any>(); const [register, state] = useRegisterMutation(); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [name, setName] = useState("");
  return <Screen><PageHeader title="이메일 회원가입" /><Field placeholder="이름" value={name} onChangeText={setName} /><Field placeholder="이메일" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" /><Field placeholder="비밀번호 (8자 이상)" value={password} onChangeText={setPassword} secureTextEntry /><Button loading={state.isLoading} title="가입하기" onPress={async () => { try { await register({ email, password, name }).unwrap(); Alert.alert("가입 완료", "로그인해 주세요."); navigation.goBack(); } catch { Alert.alert("가입 실패", "입력값 또는 중복 이메일을 확인해 주세요."); } }} /></Screen>;
}
