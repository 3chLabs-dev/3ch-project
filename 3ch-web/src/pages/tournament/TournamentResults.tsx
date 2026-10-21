import { getEntryConfig } from "./TournamentEntryFields";
import { useState } from "react";
import { Alert, Box, Button, CircularProgress, Stack } from "@mui/material";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useGetTournamentQuery, useGetTournamentResultsQuery, type TournamentStanding } from "../../features/tournament/tournamentApi";
import { RoundResultView, type StandingRow, type AwardMode } from "../league/LeagueRoundResultPage";

// Use persisted tournament rankings with the league's exact result presentation.
const resultRows = (rows: TournamentStanding[]): StandingRow[] => rows.map((row) => ({
  key: row.id, name: row.name, division: row.member_division, clubName: row.club_name,
  rank: String(row.rank), played: row.played, wins: row.wins, losses: row.losses,
  setsFor: row.sets_for, setsAgainst: row.sets_against,
}));

export default function TournamentResults({ view = "results" }: { view?: "results" | "ranking" }) {
  const { id = "", divisionId = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { data, isLoading, error } = useGetTournamentResultsQuery(id);
  const { data: metadata } = useGetTournamentQuery(id);
  const [selectedDivision, setSelectedDivision] = useState("");
  const divisions = data?.divisions ?? [];
  const division = divisions.find((entry) => entry.id === (divisionId || selectedDivision)) ?? (!divisionId ? divisions[0] : undefined);
  const requestedRound = Number(params.get("round"));
  const round = division?.rounds.find((entry) => entry.round_no === requestedRound)
    ?? (view === "ranking" ? [...division?.rounds ?? []].reverse().find((entry) => entry.complete) : undefined)
    ?? division?.rounds[0];
  if (isLoading) return <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}><CircularProgress /></Box>;
  if (error || !division || !round) return <Alert severity="error">대회 결과를 불러오지 못했습니다.</Alert>;
  const grouped = round.brackets?.length ? round.brackets.map((bracket, index) => ({
    key: `bracket-${index}`, title: `${bracket.name} 결과`, rows: resultRows(bracket.standings),
    awardMode: (bracket.name.includes("하위") ? "lower" : "upper") as AwardMode,
  })) : round.pools?.length ? round.pools.map((pool) => ({
    key: pool.name, title: `${pool.name}조`, rows: resultRows(pool.standings), awardMode: "league" as const,
  })) : [{ key: "league", title: round.format === "TOURNAMENT" ? "상위부" : "전체 순위", rows: resultRows(round.standings), awardMode: (round.format === "TOURNAMENT" ? "upper" : "league") as AwardMode }];
  return <Stack spacing={2}>
    {view === "ranking" && divisions.length > 1 && <Stack direction="row" spacing={1} sx={{ overflowX: "auto" }}>
      {divisions.map((entry) => <Button key={entry.id} size="small" variant={entry.id === division.id ? "contained" : "outlined"}
        onClick={() => setSelectedDivision(entry.id)} sx={{ flexShrink: 0, borderRadius: 1.5, fontWeight: 800 }}>{entry.name}</Button>)}
    </Stack>}
    <RoundResultView key={`${division.id}-${round.round_no}`} round={round.round_no + getEntryConfig(division).start_round - 1}
      subtitle={`${metadata?.tournament.title ?? ""} · ${division.name} · ${String(round.rules.round_label ?? "")}`}
      format={round.pools?.length ? "GROUP" : round.format === "TOURNAMENT" ? "TOURNAMENT" : "LEAGUE"}
      complete={round.complete} threeSet={round.rules.match_rule === "THREE_SET" || round.rules.match_rule.includes("3세트")}
      grouped={grouped} onBack={() => navigate(`/tournament/${id}`)}
      onBracket={() => navigate(`/tournament/${id}/divisions/${division.id}/bracket?round=${round.round_no}&back=results`)} />
  </Stack>;
}
