import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useMemo, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import ViewShot from "react-native-view-shot";
import { type LeagueMatch, useGetLeagueQuery, useGetMatchesQuery } from "../api/mobileApi";
import { Button, Card, Empty, Loading, PageHeader } from "../components/Ui";
import { Screen } from "../components/Screen";
import { colors } from "../theme";

export function TournamentBracketScreen() {
  const navigation = useNavigation<any>();
  const id = useRoute<any>().params.id as string;
  const shotRef = useRef<any>(null);
  const [exporting, setExporting] = useState(false);
  const query = useGetMatchesQuery(id);
  const leagueQuery = useGetLeagueQuery(id);
  const rounds = useMemo(() => {
    const result = new Map<string, LeagueMatch[]>();
    (query.data?.matches ?? []).filter((match) => match.bracket).forEach((match) => {
      const key = `${match.bracket ?? "upper"}-${match.round_number ?? 0}`;
      result.set(key, [...(result.get(key) ?? []), match]);
    });
    return [...result.entries()].sort(([a], [b]) => {
      const [aBracket, aRound] = a.split("-");
      const [bBracket, bRound] = b.split("-");
      const bracketOrder = (value: string) => value === "upper" ? 0 : 1;
      return bracketOrder(aBracket) - bracketOrder(bBracket) || Number(aRound) - Number(bRound);
    });
  }, [query.data]);
  const hasLower = rounds.some(([key]) => key.startsWith("lower-"));

  const exportBracket = async (saveToLibrary: boolean) => {
    if (!shotRef.current) return;
    setExporting(true);
    try {
      const uri = await shotRef.current.capture?.();
      if (!uri) throw new Error("capture failed");
      if (saveToLibrary) {
        const permission = await MediaLibrary.requestPermissionsAsync();
        if (!permission.granted) {
          Alert.alert("권한 필요", "대진표 이미지를 저장하려면 사진 및 동영상 접근 권한을 허용해 주세요.");
          return;
        }
        await MediaLibrary.createAssetAsync(uri);
        Alert.alert("저장 완료", "대진표 이미지를 사진앱에 저장했습니다.");
      } else if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "대진표 공유" });
      } else {
        Alert.alert("공유 불가", "이 기기에서는 파일 공유를 지원하지 않습니다.");
      }
    } catch {
      Alert.alert("실패", "대진표 이미지를 만들지 못했습니다. 다시 시도해 주세요.");
    } finally { setExporting(false); }
  };

  return <Screen refreshing={query.isFetching} onRefresh={query.refetch}>
    <PageHeader title="대진표" />
    {query.isLoading ? <Loading /> : null}
    {rounds.length ? <>
      <View style={styles.actions}>
        <Pressable onPress={() => navigation.navigate("TournamentMatchOrder", { id })} style={styles.primaryAction}><Text style={styles.primaryActionText}>경기 운영</Text></Pressable>
        <Pressable onPress={() => exportBracket(true)} disabled={exporting} style={styles.secondary}><Text style={styles.secondaryText}>이미지 저장</Text></Pressable>
        <Pressable onPress={() => exportBracket(false)} disabled={exporting} style={styles.secondary}><Text style={styles.secondaryText}>{exporting ? "..." : "공유"}</Text></Pressable>
      </View>
      <ViewShot ref={shotRef} options={{ format: "png", quality: 1, result: "tmpfile" }} style={styles.capture}>
        <Text style={styles.exportTitle}>{leagueQuery.data?.league.name ?? "우리리그"} 대진표</Text>
        {hasLower ? <Text style={styles.exportSub}>상위 브래킷 / 하위 브래킷</Text> : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bracket}>
          {rounds.map(([key, matches]) => <View key={key} style={[styles.round, key.startsWith("lower-") && styles.lowerRound]}>
            <Text style={[styles.roundTitle, key.startsWith("lower-") && styles.lowerTitle]}>{matches[0]?.match_label ?? `${key.startsWith("lower-") ? "하위" : "상위"} R${matches[0]?.round_number}`}</Text>
            {matches.map((match) => <MatchCard key={match.id} match={match} />)}
          </View>)}
        </ScrollView>
      </ViewShot>
      <Button title="경기 진행" onPress={() => navigation.navigate("Matches", { id })} />
    </> : <><Empty message="생성된 대진표가 없습니다." /><Button title="대진표 생성" onPress={() => navigation.navigate("TournamentSetup", { id })} /></>}
  </Screen>;
}

function MatchCard({ match }: { match: LeagueMatch }) {
  return <Card style={match.status === "playing" ? { ...styles.match, ...styles.playing } : styles.match}>
    <Text style={styles.matchNo}>{match.match_order}번 경기 {match.court ? `· ${match.court}` : ""}</Text>
    <Text style={styles.player}>{match.participant_a_name ?? "미정"} <Text style={styles.score}>{match.score_a ?? "-"}</Text></Text>
    <View style={styles.line} />
    <Text style={styles.player}>{match.participant_b_name ?? "미정"} <Text style={styles.score}>{match.score_b ?? "-"}</Text></Text>
  </Card>;
}
const styles = StyleSheet.create({ actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, primaryAction: { flexGrow: 1, minHeight: 46, alignItems: "center", justifyContent: "center", paddingHorizontal: 13, borderRadius: 10, backgroundColor: colors.primary }, primaryActionText: { color: "#FFFFFF", fontWeight: "800", fontSize: 14 }, secondary: { minHeight: 46, justifyContent: "center", paddingHorizontal: 13, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, secondaryText: { color: colors.text, fontWeight: "800", fontSize: 13 }, capture: { padding: 16, backgroundColor: "#FFFFFF", borderRadius: 12, gap: 4 }, exportTitle: { color: "#111827", fontSize: 18, fontWeight: "900" }, exportSub: { color: colors.muted, fontSize: 12 }, bracket: { gap: 16, paddingVertical: 12, paddingRight: 16 }, round: { width: 218, gap: 10 }, lowerRound: { backgroundColor: "#FAF5FF", padding: 8, borderRadius: 10 }, roundTitle: { color: colors.primary, fontWeight: "900", fontSize: 14 }, lowerTitle: { color: "#7C3AED" }, match: { padding: 11, gap: 6, borderWidth: 1, borderColor: colors.border }, playing: { borderColor: colors.primary, backgroundColor: colors.blueSoft }, matchNo: { color: colors.muted, fontSize: 11, fontWeight: "700" }, player: { color: colors.text, fontSize: 13, fontWeight: "700" }, score: { color: colors.primary, fontWeight: "900" }, line: { height: 1, backgroundColor: colors.border } });
