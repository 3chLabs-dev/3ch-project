import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useGetLeaguesQuery } from "../api/mobileApi";
import { Screen } from "../components/Screen";
import { Card, Empty, Header, Loading } from "../components/Ui";
import { colors } from "../theme";

export function DrawScreen() {
  const navigation = useNavigation<any>();
  const { data, isLoading, isFetching, refetch } = useGetLeaguesQuery();
  return (
    <Screen refreshing={isFetching} onRefresh={refetch}>
      <Header title="추첨" subtitle="리그 참가자와 함께 즐기는 경품 추첨" />
      <Card style={styles.guide}>
        <Ionicons name="dice" size={34} color={colors.primary} />
        <View style={styles.grow}>
          <Text style={styles.guideTitle}>추첨할 리그를 선택하세요</Text>
          <Text style={styles.muted}>리그별 추첨 생성과 결과 확인 화면을 차례로 연결할 예정입니다.</Text>
        </View>
      </Card>
      {isLoading ? <Loading /> : null}
      {!data?.leagues.length && !isLoading ? <Empty message="추첨에 사용할 리그가 없습니다." /> : null}
      {data?.leagues.slice(0, 10).map((league) => (
        <Pressable key={league.id} onPress={() => navigation.navigate("DrawList", { leagueId: league.league_code ?? league.id })}>
        <Card key={league.id}>
          <Text style={styles.title}>{league.name}</Text>
          <Text style={styles.muted}>{league.group_name ?? "개인 리그"} · 참가자 {league.participant_count ?? 0}명</Text>
        </Card>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  guide: { flexDirection: "row", alignItems: "center", backgroundColor: colors.blueSoft },
  grow: { flex: 1, gap: 4 },
  guideTitle: { color: colors.text, fontWeight: "800", fontSize: 16 },
  title: { color: colors.text, fontWeight: "800", fontSize: 15 },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 18 },
});
