import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useGetMyGroupsQuery } from "../api/mobileApi";
import { Screen } from "../components/Screen";
import { persistLogout } from "../store/authSlice";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { colors } from "../theme";

const serviceItems = [
  { label: "순위", icon: "podium-outline", target: "Ranking" },
  { label: "이용방법", icon: "book-outline", target: "Guide" },
  { label: "요금제", icon: "card-outline", target: "Pricing" },
  { label: "후원하기", icon: "heart-outline", target: "Donate" },
] as const;
const informationItems = [
  { label: "공지사항", icon: "megaphone-outline", target: "Notice" },
  { label: "자주 묻는 질문", icon: "help-circle-outline", target: "Faq" },
  { label: "1:1 문의", icon: "chatbubbles-outline", target: "Inquiry" },
  { label: "채팅 문의", icon: "chatbubble-ellipses-outline", target: "SupportChat" },
] as const;
const policyItems = [
  { label: "이용약관", icon: "document-text-outline", target: "Terms" },
  { label: "개인정보 처리방침", icon: "lock-closed-outline", target: "Privacy" },
] as const;

export function MyPageScreen() {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const preferredGroupId = useAppSelector((state) => state.app.preferredGroupId);
  const groups = useGetMyGroupsQuery().data?.groups ?? [];
  const group = groups.find((item) => item.id === preferredGroupId) ?? groups[0];
  const roleLabel = group?.role === "owner" ? "리더" : group?.role === "admin" ? "운영진" : group ? "회원" : null;
  const logout = () => Alert.alert("로그아웃", "로그아웃 하시겠습니까?", [{ text: "취소", style: "cancel" }, { text: "로그아웃", style: "destructive", onPress: () => dispatch(persistLogout()) }]);
  return <Screen contentStyle={styles.screen}>
    <View style={styles.titleRow}><Text style={styles.pageTitle}>마이페이지</Text><Pressable onPress={() => navigation.navigate("Settings")}><Ionicons name="settings-outline" size={26} color={colors.text} /></Pressable></View>
    <View style={styles.profile}><View style={styles.grow}><View style={styles.nameRow}><Text style={styles.name}>{user?.name ?? user?.email ?? "사용자"} 님</Text>{roleLabel ? <Text style={styles.role}>{roleLabel}</Text> : null}</View><Text style={styles.profileSub}>반가워요! 오늘도 우리리그를 즐겨보세요.</Text>{group ? <Text style={styles.groupName}>선택 클럽 · {group.name}</Text> : null}</View><Pressable style={styles.editButton} onPress={() => navigation.navigate("ProfileEdit")}><Text style={styles.editText}>정보수정</Text></Pressable></View>
    <MenuSection title="SERVICE" items={serviceItems} onPress={(target) => navigation.navigate(target)} />
    <MenuSection title="INFORMATION" items={informationItems} onPress={(target) => navigation.navigate(target)} />
    <MenuSection title="POLICY" items={policyItems} onPress={(target) => navigation.navigate(target)} />
    <Pressable onPress={logout}><Text style={styles.logout}>로그아웃</Text></Pressable>
  </Screen>;
}

function MenuSection({ title, items, onPress }: { title: string; items: ReadonlyArray<{ label: string; icon: keyof typeof Ionicons.glyphMap; target: string }>; onPress: (target: string) => void }) {
  return <View style={styles.sectionWrap}><Text style={styles.sectionLabel}>{title}</Text><View style={styles.menuCard}>{items.map((item, index) => <Pressable key={item.target} style={[styles.menuItem, index > 0 && styles.divider]} onPress={() => onPress(item.target)}><Ionicons name={item.icon} size={20} color={colors.muted} /><Text style={styles.menuText}>{item.label}</Text><Ionicons name="chevron-forward" size={20} color="#9CA3AF" /></Pressable>)}</View></View>;
}
const styles = StyleSheet.create({ screen: { backgroundColor: "#fff" }, titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, pageTitle: { color: colors.text, fontSize: 24, fontWeight: "900" }, profile: { flexDirection: "row", alignItems: "center", gap: 12, padding: 20, borderRadius: 12, backgroundColor: "#F5F5F5" }, grow: { flex: 1 }, nameRow: { flexDirection: "row", alignItems: "center", gap: 8 }, name: { color: colors.text, fontSize: 18, fontWeight: "900" }, role: { color: "#4F46E5", backgroundColor: "#EEF2FF", overflow: "hidden", borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, fontSize: 10, fontWeight: "800" }, profileSub: { color: colors.muted, fontSize: 12, marginTop: 5 }, groupName: { color: colors.primary, fontSize: 11, fontWeight: "700", marginTop: 5 }, editButton: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff" }, editText: { color: colors.text, fontSize: 11, fontWeight: "800" }, sectionWrap: { gap: 8 }, sectionLabel: { color: "#9CA3AF", fontSize: 10, fontWeight: "800", letterSpacing: 1 }, menuCard: { overflow: "hidden", borderRadius: 12, backgroundColor: "#F5F5F5" }, menuItem: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16 }, divider: { borderTopWidth: 1, borderTopColor: "#E5E7EB" }, menuText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "700" }, logout: { color: "#9CA3AF", fontSize: 13, paddingVertical: 8 } });
