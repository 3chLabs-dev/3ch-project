import { Ionicons } from "@expo/vector-icons";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useGetSubscriptionQuery } from "../api/mobileApi";
import { Screen } from "../components/Screen";
import { Card, Loading, PageHeader } from "../components/Ui";
import { colors } from "../theme";

const plans = [
  { id: "starter", name: "STARTER", price: "무료", color: "#6B7280", features: ["클럽 생성 및 가입", "리그·대회 1개 생성", "추첨 1개 생성"] },
  { id: "basic", name: "BASIC", price: "월 4,900원", color: "#10B981", features: ["STARTER 전체 기능", "리그·대회 월 5개", "추첨 월 5개"] },
  { id: "pro", name: "PRO", price: "월 9,900원", color: colors.primary, features: ["BASIC 전체 기능", "리그·대회 무제한", "추첨 무제한"] },
  { id: "premium", name: "PREMIUM", price: "월 19,900원", color: "#A855F7", features: ["PRO 전체 기능", "참가비 결제 취합", "AI 추천 클럽 상단 배치"] },
];

export function PricingScreen() {
  const query = useGetSubscriptionQuery();
  const current = query.data?.subscription;
  const buy = (name: string) => Alert.alert(
    `${name} 요금제`,
    "모바일 인앱 결제 연동 전까지 웹 결제 페이지에서 구매할 수 있습니다.",
    [{ text: "취소", style: "cancel" }, { text: "웹에서 보기", onPress: () => Linking.openURL("https://woorileague.com/mypage/pricing") }],
  );

  return (
    <Screen refreshing={query.isFetching} onRefresh={query.refetch}>
      <PageHeader title="요금제" />
      {query.isLoading ? <Loading /> : null}
      <Card style={styles.current}>
        <Text style={styles.label}>현재 이용 중인 요금제</Text>
        <Text style={styles.currentName}>{current?.plan?.toUpperCase() ?? "STARTER"}</Text>
        <Text style={styles.meta}>
          {current ? `${new Date(current.expires_at).toLocaleDateString("ko-KR")}까지 이용 가능` : "무료 기본 요금제를 이용 중입니다."}
        </Text>
      </Card>
      {plans.map((plan) => (
        <Card key={plan.id} style={current?.plan === plan.id ? styles.selected : undefined}>
          <View style={styles.row}>
            <Text style={[styles.planName, { color: plan.color }]}>{plan.name}</Text>
            <Text style={styles.price}>{plan.price}</Text>
          </View>
          {plan.features.map((feature) => <Text key={feature} style={styles.feature}>✓ {feature}</Text>)}
          {plan.id !== "starter" ? (
            <Pressable style={[styles.buyButton, { backgroundColor: plan.color }]} onPress={() => buy(plan.name)}>
              <Text style={styles.buyText}>요금제 구매하기</Text>
              <Ionicons name="open-outline" size={16} color="#fff" />
            </Pressable>
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  current: { backgroundColor: colors.blueSoft },
  label: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  currentName: { color: colors.primary, fontSize: 22, fontWeight: "900" },
  meta: { color: colors.muted, fontSize: 12 },
  selected: { borderWidth: 2, borderColor: colors.primary },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  planName: { fontSize: 18, fontWeight: "900" },
  price: { color: colors.text, fontSize: 16, fontWeight: "900" },
  feature: { color: colors.text, fontSize: 13, lineHeight: 21 },
  buyButton: { minHeight: 44, borderRadius: 8, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", marginTop: 6 },
  buyText: { color: "#fff", fontWeight: "800" },
});
