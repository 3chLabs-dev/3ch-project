import * as Clipboard from "expo-clipboard";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Screen } from "../components/Screen";
import { Button, Card, PageHeader } from "../components/Ui";
import { colors } from "../theme";

const BANK = "우리은행";
const ACCOUNT = "1002-123-123456";
const HOLDER = "조하지";

export function DonateScreen() {
  const copy = async () => {
    await Clipboard.setStringAsync(ACCOUNT);
    Alert.alert("복사 완료", "후원 계좌번호가 복사되었습니다.");
  };
  return (
    <Screen>
      <PageHeader title="후원하기" />
      <View style={styles.hero}>
        <Text style={styles.heart}>♡</Text>
        <Text style={styles.heroTitle}>우리리그를 응원해주세요</Text>
        <Text style={styles.heroText}>소중한 후원은 더 좋은 서비스 개발과 운영에 사용됩니다.</Text>
      </View>
      <Card>
        <Text style={styles.cardTitle}>후원 계좌 안내</Text>
        <Info label="예금주" value={HOLDER} />
        <Info label="은행" value={BANK} />
        <Info label="계좌번호" value={ACCOUNT} />
      </Card>
      <Button title="계좌번호 복사하기" onPress={copy} />
    </Screen>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <View style={styles.row}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", gap: 8, padding: 30, borderRadius: 16, backgroundColor: "#7C6BEF" },
  heart: { color: "#fff", fontSize: 52, fontWeight: "300" },
  heroTitle: { color: "#fff", fontSize: 20, fontWeight: "900" },
  heroText: { color: "#EDE9FE", textAlign: "center", fontSize: 13, lineHeight: 20 },
  cardTitle: { color: colors.text, fontWeight: "900", fontSize: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  label: { color: colors.muted, fontSize: 12 },
  value: { color: colors.text, fontWeight: "800" },
});
