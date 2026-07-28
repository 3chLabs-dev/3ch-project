import { useNavigation, useRoute } from "@react-navigation/native";
import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useGetLeagueQuery, useGetMatchesQuery, useGetParticipantsQuery, useInitTournamentMutation, useUpdateLeagueMutation } from "../api/mobileApi";
import { Button, Card, Field, Loading, PageHeader } from "../components/Ui";
import { Screen } from "../components/Screen";
import { colors } from "../theme";

const SIZES = [4, 8, 16, 32, 64, 128];
const SEEDING = [["seed", "Entry order"], ["random", "Random"], ["manual", "Manual"], ["group", "Separate groups"], ["standings", "League standings"]] as const;
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
  const [seeding, setSeeding] = useState<Seeding>("seed");
  const [advancement, setAdvancement] = useState<"upper-only" | "upper-lower">("upper-only");
  const [rules, setRules] = useState("");
  const bracketSize = size ?? suggestedSize;
  const hasTournament = (matchesQuery.data?.matches ?? []).some((match) => match.bracket);
  const saveAndCreate = async (force = false) => {
    if (participantCount < 2 && seeding !== "manual") { Alert.alert("Participants required", "Add at least two participants before creating a bracket."); return; }
    try {
      if (rules.trim()) await updateLeague({ leagueId: id, updates: { tournament_rules: rules.trim() } }).unwrap();
      await initTournament({ leagueId: id, bracket_size: bracketSize, seeding, advancement, force }).unwrap();
      navigation.replace("TournamentBracket", { id });
    } catch (error: any) { Alert.alert("Unable to create bracket", error?.data?.message ?? "Please try again."); }
  };
  const create = () => {
    if (!hasTournament) { saveAndCreate(); return; }
    Alert.alert("Regenerate bracket", "Existing tournament matches and scores will be reset.", [{ text: "Cancel", style: "cancel" }, { text: "Regenerate", style: "destructive", onPress: () => saveAndCreate(true) }]);
  };
  return <Screen maxWidth={720} refreshing={participantsQuery.isFetching || matchesQuery.isFetching} onRefresh={() => { participantsQuery.refetch(); matchesQuery.refetch(); leagueQuery.refetch(); }}>
    <PageHeader title="Tournament bracket" />
    {participantsQuery.isLoading ? <Loading /> : null}
    <Card><Text style={styles.title}>{participantCount} participants</Text><Text style={styles.help}>Choose a bracket size equal to or larger than the participant count.</Text><Text style={styles.label}>Bracket size</Text><View style={styles.chips}>{SIZES.map((item) => <Chip key={item} label={`Round of ${item}`} active={bracketSize === item} onPress={() => setSize(item)} />)}</View><Text style={styles.label}>Seeding</Text><View style={styles.chips}>{SEEDING.map(([value, label]) => <Chip key={value} label={label} active={seeding === value} onPress={() => setSeeding(value)} />)}</View><Text style={styles.label}>Advancement</Text><View style={styles.chips}><Chip label="Upper bracket" active={advancement === "upper-only"} onPress={() => setAdvancement("upper-only")} /><Chip label="Upper and lower" active={advancement === "upper-lower"} onPress={() => setAdvancement("upper-lower")} /></View><Text style={styles.label}>Tournament rules</Text><Field value={rules} onChangeText={setRules} placeholder={leagueQuery.data?.league.tournament_rules ?? "e.g. best of five"} multiline /><Button title={hasTournament ? "Regenerate bracket" : "Create bracket"} loading={state.isLoading} onPress={create} /></Card>
  </Screen>;
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>; }
const styles = StyleSheet.create({ title: { color: colors.text, fontSize: 20, fontWeight: "900" }, help: { color: colors.muted, fontSize: 13, lineHeight: 19 }, label: { color: colors.text, fontWeight: "800", marginTop: 8 }, chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, chip: { backgroundColor: "#F3F4F6", borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9 }, chipActive: { backgroundColor: colors.primary }, chipText: { color: "#374151", fontWeight: "800", fontSize: 12 }, chipTextActive: { color: "#FFFFFF" } });
