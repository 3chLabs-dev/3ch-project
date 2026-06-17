import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useGetPreferencesQuery, useUpdatePreferencesMutation, type UserPreferences } from "../api/mobileApi";
import { Screen } from "../components/Screen";
import { Loading } from "../components/Ui";
import { colors } from "../theme";

const items: Array<{ key: keyof UserPreferences; label: string; desc: string; icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = [
  { key: "show_group", label: "나의 조편성 표시", desc: "홈 화면에 배정된 조편성 정보를 표시합니다.", icon: "grid-outline", color: "#6366F1", bg: "#EEF2FF" },
  { key: "show_game", label: "나의 경기 표시", desc: "홈 화면에 예정된 경기 일정을 표시합니다.", icon: "tennisball-outline", color: colors.primary, bg: colors.blueSoft },
  { key: "show_win", label: "나의 당첨내역 표시", desc: "홈 화면에 추첨 당첨 내역을 표시합니다.", icon: "gift-outline", color: "#D97706", bg: colors.amberSoft },
];

export function SettingsScreen() {
  const navigation = useNavigation<any>();
  const { data, isLoading } = useGetPreferencesQuery();
  const [update, { isLoading: updating }] = useUpdatePreferencesMutation();
  const toggle = (key: keyof UserPreferences) => {
    if (data) update({ ...data, [key]: !data[key] });
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}><Ionicons name="chevron-back" size={26} color={colors.text} /></Pressable>
        <Text style={styles.title}>설정</Text>
      </View>
      <Text style={styles.label}>홈 화면 표시</Text>
      {isLoading ? <Loading /> : (
        <View style={styles.card}>
          {items.map((item, index) => (
            <Pressable key={item.key} style={[styles.item, index > 0 && styles.divider]} onPress={() => toggle(item.key)}>
              <View style={[styles.icon, { backgroundColor: item.bg }]}><Ionicons name={item.icon} size={20} color={item.color} /></View>
              <View style={styles.grow}>
                <Text style={styles.itemTitle}>{item.label}</Text>
                <Text style={styles.desc}>{item.desc}</Text>
              </View>
              <Switch disabled={updating} value={data?.[item.key] ?? false} onValueChange={() => toggle(item.key)} trackColor={{ true: colors.primary }} />
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { color: colors.text, fontSize: 22, fontWeight: "900" },
  label: { color: "#9CA3AF", fontSize: 11, fontWeight: "800", letterSpacing: 0.8 },
  card: { overflow: "hidden", borderRadius: 12, backgroundColor: colors.surface, elevation: 2 },
  item: { minHeight: 82, flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  icon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  grow: { flex: 1 },
  itemTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  desc: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
});
