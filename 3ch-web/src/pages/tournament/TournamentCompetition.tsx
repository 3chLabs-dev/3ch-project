import { Alert, Box, CircularProgress } from "@mui/material";
import { useParams, useSearchParams } from "react-router-dom";
import LeagueMatchOrder from "../league/LeagueMatchOrder";
import LeagueGPTVisionSheet from "../league/LeagueGPTVisionSheet";
import LeagueTournamentBracket from "../league/LeagueTournamentBracket";
import { useGetTournamentQuery } from "../../features/tournament/tournamentApi";

export default function TournamentCompetition({ view }: { view: "matches" | "bracket" }) {
  const { id = "", divisionId = "" } = useParams();
  const [params] = useSearchParams();
  const { data, isLoading, error } = useGetTournamentQuery(id);
  const division = data?.tournament.divisions?.find(entry => entry.id === divisionId);
  const round = division?.rounds.find(entry => entry.round_no === Number(params.get("round") || 1));
  if (isLoading) return <Box sx={{ textAlign: "center", pt: 8 }}><CircularProgress /></Box>;
  if (error || !round) return <Alert severity="error">대회 라운드를 불러오지 못했습니다.</Alert>;
  if (view === "matches") return <LeagueMatchOrder />;
  return round.format === "TOURNAMENT" ? <LeagueTournamentBracket /> : <LeagueGPTVisionSheet />;
}
