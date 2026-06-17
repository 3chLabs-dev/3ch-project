import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useLoginMutation } from "../api/mobileApi";
import { Screen } from "../components/Screen";
import { Button, ErrorMessage, Field } from "../components/Ui";
import { persistLogin } from "../store/authSlice";
import { useAppDispatch } from "../store/hooks";
import { colors } from "../theme";

export function LoginScreen() {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const [login, { isLoading }] = useLoginMutation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    try {
      const result = await login({ email: email.trim(), password }).unwrap();
      await dispatch(persistLogin({ token: result.token, user: result.user })).unwrap();
    } catch {
      setError("로그인에 실패했습니다. 이메일과 비밀번호를 확인해 주세요.");
    }
  };

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.logoCircle}><Ionicons name="trophy" size={34} color="#fff" /></View>
      <Text style={styles.brand}>우리리그</Text>
      <Text style={styles.title}>로그인</Text>
      <Field autoCapitalize="none" keyboardType="email-address" onChangeText={setEmail} placeholder="아이디(이메일)" value={email} />
      <Field onChangeText={setPassword} placeholder="비밀번호" secureTextEntry value={password} />
      {error ? <ErrorMessage message={error} /> : null}
      <Button loading={isLoading} onPress={submit} title="로그인" rounded />
      <Text style={styles.findPassword}>비밀번호 찾기</Text>
      <View style={styles.dividerRow}><View style={styles.line} /><Text style={styles.dividerText}>간편 로그인</Text><View style={styles.line} /></View>
      <SocialButton icon="logo-google" label="구글로 시작하기" background="#FFFFFF" color="#111111" border />
      <SocialButton icon="chatbubble" label="카카오로 시작하기" background="#FFEB3B" color="#111111" />
      <Pressable onPress={() => navigation.navigate("SignUp")}><SocialButton icon="mail" label="이메일로 가입하기" background="#4A90E2" color="#FFFFFF" /></Pressable>
      <Text style={styles.helper}>소셜 로그인은 모바일 딥링크 연동 후 활성화됩니다.</Text>
    </Screen>
  );
}

function SocialButton({
  icon,
  label,
  background,
  color,
  border = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  background: string;
  color: string;
  border?: boolean;
}) {
  return (
    <View style={[styles.social, { backgroundColor: background, borderWidth: border ? 1 : 0 }]}>
      <Ionicons name={icon} size={23} color={color} />
      <Text style={[styles.socialLabel, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 22 },
  logoCircle: { alignSelf: "center", width: 62, height: 62, borderRadius: 31, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  brand: { textAlign: "center", color: colors.primary, fontSize: 17, fontWeight: "900", marginTop: -6 },
  title: { textAlign: "center", color: colors.text, fontSize: 30, fontWeight: "900", marginBottom: 12 },
  findPassword: { textAlign: "right", color: colors.muted, fontSize: 12, fontWeight: "600" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 4 },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.muted, fontSize: 13 },
  social: { minHeight: 48, borderColor: "#CFCFCF", borderRadius: 999, flexDirection: "row", alignItems: "center", paddingHorizontal: 20 },
  socialLabel: { flex: 1, textAlign: "center", fontWeight: "600", marginRight: 23 },
  helper: { color: colors.muted, textAlign: "center", fontSize: 11, lineHeight: 17 },
});
