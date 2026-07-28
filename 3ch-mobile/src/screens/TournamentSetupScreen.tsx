import { useNavigation, useRoute } from "@react-navigation/native";
import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useGetLeagueQuery, useGetMatchesQuery, useGetParticipantsQuery, useInitTournamentMutation, useUpdateLeagueMutation } from "../api/mobileApi";
import { Button, Card, Field, Loading, PageHeader } from "../components/Ui";
import { Screen } from "../components/Screen";
import { colors } from "../theme";

const SIZES = [4, 8, 16, 32, 64, 128];
const SEEDING = [["seed", "\uc2dc\ub4dc(\ub4f1\ub85d \uc21c\uc11c)"], ["random", "\ubb34\uc791\uc704"], ["manual", "\uc218\ub3d9"], ["group", "\uc870 \ubd84\ub9ac"], ["standings", "\uc2dc\ub4dc(\uc21c\uc704)"]] as const;
type Seeding = "seed" | "random" | "manual" | "group" | "standings";

export function TournamentSetupScreen() {
  const navigation = useNavigation<any>();
  const id = useRoute<any>().params.id as string;
  const participantsQuery = useGetParticipantsQuery(id);
  const leagueQuery = useGetLeagueQuery(id);
  const matchesQuery = useGetMatchesQuery(id);
  const [initTournament, state] = useInitTournamentMutation();
  const [updateLeague] = useUpdateLeagueMutation();
  const participantCount = participantsQuery.data?.participants.length ?? 0;
  const suggestedSize = useMemo(() => SIZES.find((item) => item >= Math.max(participantCount, 4)) ?? 128, [participantCount]);
  const [size, setSize] = useState<number | null>(null);
  const [seeding, setSeeding] = useState<Seeding>(leagueQuery.data?.league.tournament_seeding as Seeding ?? "seed");
  const [advancement, setAdvancement] = useState<"upper-only" | "upper-lower">(leagueQuery.data?.league.tournament_advancement === "upper-lower" ? "upper-lower" : "upper-only");
  const [rules, setRules] = useState(leagueQuery.data?.league.tournament_rules ?? "5\uc804 3\uc120\uc2b9\uc81c");
  const bracketSize = size ?? suggestedSize;
  const hasTournament = (matchesQuery.data?.matches ?? []).some((match) => match.bracket);
  const saveAndCreate = async (force = false) => {
    if (participantCount < 2 && seeding !== "manual") { Alert.alert("\ucc38\uac00\uc790 \ud544\uc694", "\ub300\uc9c4\ud45c\ub97c \uc0dd\uc131\ud558\ub824\uba74 \ucc38\uac00\uc790\ub97c 2\uba85 \uc774\uc0c1 \ub4f1\ub85d\ud574 \uc8fc\uc138\uc694."); return; }
    try {
      await updateLeague({ leagueId: id, updates: { tournament_rules: rules.trim() } }).unwrap();
      await initTournament({ leagueId: id, bracket_size: bracketSize, seeding, advancement, force }).unwrap();
      navigation.replace("TournamentList", { id });
    } catch (error: any) { Alert.alert("\ub300\uc9c4\ud45c \uc0dd\uc131 \uc2e4\ud328", error?.data?.message ?? "\ub2e4\uc2dc \uc2dc\ub3c4\ud574 \uc8fc\uc138\uc694."); }
  };
  const create = () => {
    if (!hasTournament) { saveAndCreate(); return; }
    Alert.alert("\ub300\uc9c4\ud45c \uc7ac\uc0dd\uc131", "\uae30\uc874 \ub300\uc9c4\uacfc \uacbd\uae30 \uae30\ub85d\uc774 \ucd08\uae30\ud654\ub429\ub2c8\ub2e4.", [{ text: "\ucde8\uc18c", style: "cancel" }, { text: "\uc7ac\uc0dd\uc131", style: "destructive", onPress: () => saveAndCreate(true) }]);
  };
  return <Screen maxWidth={720} refreshing={participantsQuery.isFetching || matchesQuery.isFetching} onRefresh={() => { participantsQuery.refetch(); matchesQuery.refetch(); leagueQuery.refetch(); }}>
    <PageHeader title="\ud1a0\ub108\uba3c\ud2b8 \ub300\uc9c4\ud45c \uc0dd\uc131" />
    {participantsQuery.isLoading ? <Loading /> : null}
    <View style={styles.content}>
      <Section title="\ud1a0\ub108\uba3c\ud2b8 \uc720\ud615"><View style={styles.options}><Choice label="\ub2e8\uc77c \ud1a0\ub108\uba3c\ud2b8" description="\ud558\ub098\uc758 \ub300\uc9c4\ud45c\ub85c \uc6b4\uc601\ud569\ub2c8\ub2e4." active={advancement === "upper-only"} onPress={() => setAdvancement("upper-only")} /><Choice label="\uc0c1\uc704\ubd80 / \ud558\uc704\ubd80" description="1\ub77c\uc6b4\ub4dc \uc2b9\uc790\ub294 \uc0c1\uc704\ubd80, \ud328\uc790\ub294 \ud558\uc704\ubd80\ub85c \uc9c4\ucd9c\ud569\ub2c8\ub2e4." active={advancement === "upper-lower"} onPress={() => setAdvancement("upper-lower")} /></View></Section>
      <Section title="\ubcf8\uc120 \uc2dc\uc791 \ub2e8\uacc4"><View style={styles.chips}>{SIZES.map((item) => <Chip key={item} label={`${item}\uac15`} active={bracketSize === item} onPress={() => setSize(item)} />)}</View><Text style={styles.help}>\ucc38\uac00 \uc778\uc6d0\uc774 \ubd80\uc871\ud55c \uacbd\uae30\ub294 \ubd80\uc804\uc2b9\uc73c\ub85c \ucc98\ub9ac\ub429\ub2c8\ub2e4.</Text></Section>
      <Section title="\ubc30\uce58 \ubc29\uc2dd"><View style={styles.chips}>{SEEDING.map(([value, label]) => <Chip key={value} label={label} active={seeding === value} onPress={() => setSeeding(value)} />)}</View><Text style={styles.help}>{seeding === "manual" ? "\uad00\ub9ac\uc790\uac00 1\ub77c\uc6b4\ub4dc \uc2ac\ub86f\uc5d0 \ucc38\uac00\uc790\ub97c \uc9c1\uc811 \ubc30\uc815\ud569\ub2c8\ub2e4." : "\uc120\ud0dd\ud55c \uae30\uc900\uc5d0 \ub530\ub77c \ucc38\uac00\uc790\ub97c \uc790\ub3d9 \ubc30\uce58\ud569\ub2c8\ub2e4."}</Text></Section>
      <Section title="\ubcf8\uc120 \uaddc\uce59"><Field value={rules} onChangeText={setRules} placeholder="\uc608: 5\uc804 3\uc120\uc2b9\uc81c" /></Section>
      <Card style={styles.summary}><Text style={styles.summaryTitle}>\ucc38\uac00\uc790 {participantCount}\uba85 \u00b7 {bracketSize}\uac15 \ub300\uc9c4</Text><Text style={styles.help}>\uc0dd\uc131 \ud6c4 \uacbd\uae30 \uc21c\uc11c \ud654\uba74\uc5d0\uc11c \ucf54\ud2b8, \uc21c\uc11c, \uc218\ub3d9 \uc2dc\ub4dc\ub97c \uc6b4\uc601\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4.</Text></Card>
      <Button title={hasTournament ? "\ub300\uc9c4\ud45c \uc7ac\uc0dd\uc131" : "\uc644\ub8cc"} loading={state.isLoading} onPress={create} />
    </View>
  </Screen>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) { return <View style={styles.section}><Text style={styles.label}>{title}</Text>{children}</View>; }
function Choice({ label, description, active, onPress }: { label: string; description: string; active: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.choice, active && styles.choiceActive]}><Text style={[styles.choiceTitle, active && styles.choiceTitleActive]}>{label}</Text><Text style={styles.choiceDescription}>{description}</Text></Pressable>; }
function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>; }
const styles = StyleSheet.create({ content: { gap: 24 }, section: { gap: 10 }, label: { color: colors.text, fontWeight: "800", fontSize: 14 }, options: { flexDirection: "row", gap: 10 }, choice: { flex: 1, minHeight: 104, padding: 13, gap: 6, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface }, choiceActive: { borderColor: colors.primary, backgroundColor: colors.blueSoft }, choiceTitle: { color: colors.text, fontWeight: "800", fontSize: 13 }, choiceTitleActive: { color: colors.primary }, choiceDescription: { color: colors.muted, fontSize: 11, lineHeight: 16 }, chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, chip: { backgroundColor: "#F3F4F6", borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9 }, chipActive: { backgroundColor: colors.primary }, chipText: { color: "#374151", fontWeight: "800", fontSize: 12 }, chipTextActive: { color: "#FFFFFF" }, help: { color: colors.muted, fontSize: 12, lineHeight: 18 }, summary: { backgroundColor: "#F8FAFC", gap: 5 }, summaryTitle: { color: colors.text, fontSize: 14, fontWeight: "900" } });
