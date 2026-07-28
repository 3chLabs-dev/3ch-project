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
          Alert.alert("\uad8c\ud55c \ud544\uc694", "\ub300\uc9c4\ud45c \uc774\ubbf8\uc9c0\ub97c \uc800\uc7a5\ud558\ub824\uba74 \uc0ac\uc9c4 \ubc0f \ub3d9\uc601\uc0c1 \uc811\uadfc \uad8c\ud55c\uc744 \ud5c8\uc6a9\ud574 \uc8fc\uc138\uc694.");
          return;
        }
        await MediaLibrary.createAssetAsync(uri);
        Alert.alert("\uc800\uc7a5 \uc644\ub8cc", "\ub300\uc9c4\ud45c \uc774\ubbf8\uc9c0\ub97c \uc0ac\uc9c4\uc571\uc5d0 \uc800\uc7a5\ud588\uc2b5\ub2c8\ub2e4.");
      } else if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "\ub300\uc9c4\ud45c \uacf5\uc720" });
      } else {
        Alert.alert("\uacf5\uc720 \ubd88\uac00", "\uc774 \uae30\uae30\uc5d0\uc11c\ub294 \ud30c\uc77c \uacf5\uc720\ub97c \uc9c0\uc6d0\ud558\uc9c0 \uc54a\uc2b5\ub2c8\ub2e4.");
      }
    } catch {
      Alert.alert("\uc2e4\ud328", "\ub300\uc9c4\ud45c \uc774\ubbf8\uc9c0\ub97c \ub9cc\ub4e4\uc9c0 \ubabb\ud588\uc2b5\ub2c8\ub2e4. \ub2e4\uc2dc \uc2dc\ub3c4\ud574 \uc8fc\uc138\uc694.");
    } finally { setExporting(false); }
  };

  return <Screen refreshing={query.isFetching} onRefresh={query.refetch}>
    <PageHeader title="\ub300\uc9c4\ud45c" />
    {query.isLoading ? <Loading /> : null}
    {rounds.length ? <>
      <View style={styles.actions}>
        <Pressable onPress={() => navigation.navigate("TournamentMatchOrder", { id })} style={styles.primaryAction}><Text style={styles.primaryActionText}>\uacbd\uae30 \uc6b4\uc601</Text></Pressable>
        <Pressable onPress={() => exportBracket(true)} disabled={exporting} style={styles.secondary}><Text style={styles.secondaryText}>\uc774\ubbf8\uc9c0 \uc800\uc7a5</Text></Pressable>
        <Pressable onPress={() => exportBracket(false)} disabled={exporting} style={styles.secondary}><Text style={styles.secondaryText}>{exporting ? "..." : "\uacf5\uc720"}</Text></Pressable>
      </View>
      <ViewShot ref={shotRef} options={{ format: "png", quality: 1, result: "tmpfile" }} style={styles.capture}>
        <Text style={styles.exportTitle}>{leagueQuery.data?.league.name ?? "\uc6b0\ub9ac\ub9ac\uadf8"} \ub300\uc9c4\ud45c</Text>
        {hasLower ? <Text style={styles.exportSub}>\uc0c1\uc704 \ube0c\ub798\ud0b7 / \ud558\uc704 \ube0c\ub798\ud0b7</Text> : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bracket}>
          {rounds.map(([key, matches]) => <View key={key} style={[styles.round, key.startsWith("lower-") && styles.lowerRound]}>
            <Text style={[styles.roundTitle, key.startsWith("lower-") && styles.lowerTitle]}>{matches[0]?.match_label ?? `${key.startsWith("lower-") ? "\ud558\uc704" : "\uc0c1\uc704"} R${matches[0]?.round_number}`}</Text>
            {matches.map((match) => <MatchCard key={match.id} match={match} />)}
          </View>)}
        </ScrollView>
      </ViewShot>
      <Button title="\uacbd\uae30 \uc9c4\ud589" onPress={() => navigation.navigate("Matches", { id })} />
    </> : <><Empty message="\uc0dd\uc131\ub41c \ub300\uc9c4\ud45c\uac00 \uc5c6\uc2b5\ub2c8\ub2e4." /><Button title="\ub300\uc9c4\ud45c \uc0dd\uc131" onPress={() => navigation.navigate("TournamentSetup", { id })} /></>}
  </Screen>;
}

function MatchCard({ match }: { match: LeagueMatch }) {
  return <Card style={match.status === "playing" ? { ...styles.match, ...styles.playing } : styles.match}>
    <Text style={styles.matchNo}>{match.match_order}\ubc88 \uacbd\uae30 {match.court ? `\u00b7 ${match.court}` : ""}</Text>
    <Text style={styles.player}>{match.participant_a_name ?? "\ubbf8\uc815"} <Text style={styles.score}>{match.score_a ?? "-"}</Text></Text>
    <View style={styles.line} />
    <Text style={styles.player}>{match.participant_b_name ?? "\ubbf8\uc815"} <Text style={styles.score}>{match.score_b ?? "-"}</Text></Text>
  </Card>;
}
const styles = StyleSheet.create({ actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, primaryAction: { flexGrow: 1, minHeight: 46, alignItems: "center", justifyContent: "center", paddingHorizontal: 13, borderRadius: 10, backgroundColor: colors.primary }, primaryActionText: { color: "#FFFFFF", fontWeight: "800", fontSize: 14 }, secondary: { minHeight: 46, justifyContent: "center", paddingHorizontal: 13, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, secondaryText: { color: colors.text, fontWeight: "800", fontSize: 13 }, capture: { padding: 16, backgroundColor: "#FFFFFF", borderRadius: 12, gap: 4 }, exportTitle: { color: "#111827", fontSize: 18, fontWeight: "900" }, exportSub: { color: colors.muted, fontSize: 12 }, bracket: { gap: 16, paddingVertical: 12, paddingRight: 16 }, round: { width: 218, gap: 10 }, lowerRound: { backgroundColor: "#FAF5FF", padding: 8, borderRadius: 10 }, roundTitle: { color: colors.primary, fontWeight: "900", fontSize: 14 }, lowerTitle: { color: "#7C3AED" }, match: { padding: 11, gap: 6, borderWidth: 1, borderColor: colors.border }, playing: { borderColor: colors.primary, backgroundColor: colors.blueSoft }, matchNo: { color: colors.muted, fontSize: 11, fontWeight: "700" }, player: { color: colors.text, fontSize: 13, fontWeight: "700" }, score: { color: colors.primary, fontWeight: "900" }, line: { height: 1, backgroundColor: colors.border } });
