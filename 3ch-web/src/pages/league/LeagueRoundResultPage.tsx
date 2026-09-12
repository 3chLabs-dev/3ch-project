import { useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import { DivisionBadge } from "../../components/ParticipantName";
import type { LeagueMatch } from "../../features/league/leagueApi";
import {
  useGetLeagueMatchesQuery,
  useGetLeagueProgramQuery,
  useGetLeagueQuery,
} from "../../features/league/leagueApi";

type RoundFormat = "LEAGUE" | "GROUP" | "TOURNAMENT";
type RoundType = "SINGLES" | "DOUBLES" | "TEAM";
type ResultUnit = { key: string; name: string; division: string | null };
type StandingRow = ResultUnit & { rank: string; wins: number; losses: number; setsFor: number; setsAgainst: number };
type ProgramBlock = {
  title?: string;
  type?: RoundType;
  format?: RoundFormat;
  matchRule?: string;
};

const rankCellSx = { width: 52, px: 0.75, py: 1, textAlign: "center", fontSize: 12, fontWeight: 900 } as const;
const bodyCellSx = { px: 0.75, py: 1, fontSize: 12, whiteSpace: "nowrap" } as const;

function sideUnit(match: LeagueMatch, side: "a" | "b"): ResultUnit | null {
  const participantId = side === "a" ? match.participant_a_id : match.participant_b_id;
  const roster = side === "a" ? match.participant_a_roster : match.participant_b_roster;
  const details = side === "a" ? match.participant_a_roster_details : match.participant_b_roster_details;
  const name = side === "a" ? match.participant_a_name : match.participant_b_name;
  const division = side === "a" ? match.participant_a_division : match.participant_b_division;
  const rosterKey = roster?.filter(Boolean).slice().sort().join("|");
  const key = rosterKey || participantId;
  if (!key) return null;
  return {
    key,
    name: name || details?.map((player) => player.name).join(" · ") || "-",
    division: division || details?.map((player) => player.division).filter(Boolean).join("+") || null,
  };
}

function winnerAndLoser(match: LeagueMatch) {
  const a = sideUnit(match, "a");
  const b = sideUnit(match, "b");
  if (!a && !b) return { winner: null, loser: null };
  if (!a) return { winner: b, loser: null };
  if (!b) return { winner: a, loser: null };
  const scoreA = Number(match.score_a ?? 0);
  const scoreB = Number(match.score_b ?? 0);
  if (scoreA === scoreB) return { winner: null, loser: null };
  return scoreA > scoreB ? { winner: a, loser: b } : { winner: b, loser: a };
}

function setRate(row: StandingRow) {
  const total = row.setsFor + row.setsAgainst;
  return total ? `${((row.setsFor / total) * 100).toFixed(1)}%` : "-";
}

function roundRobinStandings(matches: LeagueMatch[], threeSet: boolean): StandingRow[] {
  const stats = new Map<string, StandingRow>();
  const ensure = (unit: ResultUnit) => {
    if (!stats.has(unit.key)) stats.set(unit.key, { ...unit, rank: "", wins: 0, losses: 0, setsFor: 0, setsAgainst: 0 });
    return stats.get(unit.key)!;
  };
  matches.filter((match) => !match.is_no_game && match.status === "done").forEach((match) => {
    const a = sideUnit(match, "a");
    const b = sideUnit(match, "b");
    if (!a || !b) return;
    const scoreA = Number(match.score_a ?? 0);
    const scoreB = Number(match.score_b ?? 0);
    const aRow = ensure(a);
    const bRow = ensure(b);
    aRow.setsFor += scoreA;
    aRow.setsAgainst += scoreB;
    bRow.setsFor += scoreB;
    bRow.setsAgainst += scoreA;
    if (scoreA > scoreB) { aRow.wins += 1; bRow.losses += 1; }
    if (scoreB > scoreA) { bRow.wins += 1; aRow.losses += 1; }
  });
  return [...stats.values()]
    .sort((left, right) => (threeSet ? right.setsFor - left.setsFor : right.wins - left.wins) || (right.setsFor - right.setsAgainst) - (left.setsFor - left.setsAgainst) || right.setsFor - left.setsFor || left.name.localeCompare(right.name, "ko"))
    .map((row, index) => ({ ...row, rank: String(index + 1) }));
}

function stageLabel(match: LeagueMatch) {
  const label = String(match.match_label || "").replace(/^(상위|하위)\s*/, "");
  if (/^(결승|\d+강)$/.test(label)) return label;
  const round = Number(match.round_number || 1);
  return `${2 ** Math.max(1, round)}강`;
}

function tournamentStandings(matches: LeagueMatch[]): StandingRow[] {
  const done = matches.filter((match) => match.status === "done");
  const units = new Map<string, ResultUnit>();
  done.forEach((match) => [sideUnit(match, "a"), sideUnit(match, "b")].forEach((unit) => { if (unit) units.set(unit.key, unit); }));
  const placement = new Map<string, string>();
  const stats = new Map<string, Omit<StandingRow, "rank">>();
  units.forEach((unit) => stats.set(unit.key, { ...unit, wins: 0, losses: 0, setsFor: 0, setsAgainst: 0 }));
  done.filter((match) => !match.is_no_game).forEach((match) => {
    const a = sideUnit(match, "a");
    const b = sideUnit(match, "b");
    if (!a || !b) return;
    const aRow = stats.get(a.key)!;
    const bRow = stats.get(b.key)!;
    const scoreA = Number(match.score_a ?? 0);
    const scoreB = Number(match.score_b ?? 0);
    aRow.setsFor += scoreA; aRow.setsAgainst += scoreB;
    bRow.setsFor += scoreB; bRow.setsAgainst += scoreA;
    if (scoreA > scoreB) { aRow.wins += 1; bRow.losses += 1; }
    if (scoreB > scoreA) { bRow.wins += 1; aRow.losses += 1; }
  });
  const thirdPlace = done.find((match) => /3[·.]?4위전/.test(match.match_label || ""));
  const regular = done.filter((match) => match !== thirdPlace);
  const finalMatch = regular.find((match) => /결승$/.test(match.match_label || ""))
    ?? regular.slice().sort((a, b) => Number(b.round_number || 0) - Number(a.round_number || 0))[0];
  if (finalMatch) {
    const result = winnerAndLoser(finalMatch);
    if (result.winner) placement.set(result.winner.key, "1");
    if (result.loser) placement.set(result.loser.key, "2");
  }
  if (thirdPlace) {
    const result = winnerAndLoser(thirdPlace);
    if (result.winner) placement.set(result.winner.key, "3");
    if (result.loser) placement.set(result.loser.key, "4");
  }
  regular.forEach((match) => {
    if (match === finalMatch) return;
    const { loser } = winnerAndLoser(match);
    if (!loser || placement.has(loser.key)) return;
    const reachesFinal = finalMatch && match.next_match_id === finalMatch.id;
    placement.set(loser.key, reachesFinal ? "3" : stageLabel(match));
  });
  const order = (rank: string) => rank === "1" ? 1 : rank === "2" ? 2 : rank === "3" ? 3 : rank === "4" ? 4 : Number(rank.replace("강", "")) || 999;
  return [...units.values()].map((unit) => ({ ...stats.get(unit.key)!, rank: placement.get(unit.key) || "-" }))
    .sort((left, right) => order(left.rank) - order(right.rank) || left.name.localeCompare(right.name, "ko"));
}

function ResultTable({ rows, threeSet }: { rows: StandingRow[]; threeSet: boolean }) {
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5, overflowX: "auto" }}>
      <Table size="small" sx={{ minWidth: 390 }}>
        <TableHead><TableRow sx={{ bgcolor: "#F8FAFC" }}>
          <TableCell sx={rankCellSx}>순위</TableCell>
          <TableCell sx={{ ...bodyCellSx, fontWeight: 800 }}>이름</TableCell>
          <TableCell align="center" sx={{ ...bodyCellSx, fontWeight: 800 }}>부수</TableCell>
          <TableCell align="center" sx={{ ...bodyCellSx, fontWeight: 800 }}>{threeSet ? "세트합" : "승/패"}</TableCell>
          <TableCell align="center" sx={{ ...bodyCellSx, fontWeight: 800 }}>세트득실률</TableCell>
        </TableRow></TableHead>
        <TableBody>
          {rows.map((row) => <TableRow key={row.key}>
            <TableCell sx={rankCellSx}>{row.rank}</TableCell>
            <TableCell sx={{ ...bodyCellSx, fontWeight: 800 }}>{row.name}</TableCell>
            <TableCell align="center" sx={bodyCellSx}><DivisionBadge division={row.division} /></TableCell>
            <TableCell align="center" sx={bodyCellSx}>{threeSet ? row.setsFor : `${row.wins}/${row.losses}`}</TableCell>
            <TableCell align="center" sx={bodyCellSx}>{setRate(row)}</TableCell>
          </TableRow>)}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default function LeagueRoundResultPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const round = Math.max(1, Number(searchParams.get("round") || 1));
  const { data: leagueData, isLoading: leagueLoading } = useGetLeagueQuery(id, { skip: !id });
  const { data: matchData, isLoading: matchLoading } = useGetLeagueMatchesQuery(id, { skip: !id });
  const { data: programData, isLoading: programLoading } = useGetLeagueProgramQuery(id, { skip: !id });
  const block = ((programData?.program?.program_data as { blocks?: ProgramBlock[] } | undefined)?.blocks || [])[round - 1];
  const format: RoundFormat = block?.format || "GROUP";
  const matches = useMemo(() => (matchData?.matches || []).filter((match) => match.is_program && match.program_round === round), [matchData?.matches, round]);
  const complete = matches.length > 0 && matches.every((match) => match.is_no_game || match.status === "done");
  const threeSet = block?.matchRule === "THREE_SET" || block?.matchRule?.includes("3세트") || matches.some((match) => match.match_rule === "THREE_SET" || match.match_rule?.includes("3세트"));
  const bracketPath = format === "TOURNAMENT" ? "tournament-bracket" : "bracket";
  const grouped = useMemo(() => {
    if (format === "LEAGUE") return [{ key: "league", title: "전체 순위", rows: roundRobinStandings(matches, threeSet) }];
    if (format === "GROUP") {
      const labels = [...new Set(matches.map((match) => match.bracket || "1조"))];
      return labels.map((label) => ({ key: label, title: label, rows: roundRobinStandings(matches.filter((match) => (match.bracket || "1조") === label), threeSet) }));
    }
    const indexes = [...new Set(matches.map((match) => match.tournament_bracket_index || 1))].sort((a, b) => a - b);
    const brackets = [...new Set(matches.map((match) => match.bracket || "upper"))];
    return indexes.flatMap((index) => brackets.map((bracket) => ({
      key: `${index}-${bracket}`,
      title: `${bracket === "lower" ? "하위부" : "상위부"}${indexes.length > 1 ? ` ${index}조` : ""}`,
      rows: tournamentStandings(matches.filter((match) => (match.tournament_bracket_index || 1) === index && (match.bracket || "upper") === bracket)),
    })).filter((section) => section.rows.length > 0));
  }, [format, matches, threeSet]);

  if (leagueLoading || matchLoading || programLoading) return <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}><CircularProgress /></Box>;
  return (
    <Stack spacing={2.5} sx={{ pb: 5 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <IconButton size="small" onClick={() => navigate(`/league/${id}`)}><ArrowBackIcon /></IconButton>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 18, fontWeight: 900 }}>{round}라운드 결과</Typography>
          <Typography sx={{ fontSize: 11, color: "text.secondary", fontWeight: 700 }}>{leagueData?.league.name} · {block?.title}</Typography>
        </Box>
        <Button
          size="small"
          variant="outlined"
          startIcon={<AccountTreeOutlinedIcon sx={{ fontSize: 15 }} />}
          onClick={() => navigate(`/league/${id}/program/${bracketPath}?program=1&round=${round}&format=${format}&back=results`)}
          sx={{ flexShrink: 0, borderRadius: "16px", px: 1.25, fontSize: 11, fontWeight: 800, whiteSpace: "nowrap" }}
        >대진표 보기</Button>
      </Stack>
      {!complete ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: "center", borderRadius: 1.5 }}><Typography fontWeight={800}>아직 라운드가 종료되지 않았습니다.</Typography></Paper>
      ) : grouped.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: "center", borderRadius: 1.5 }}><Typography fontWeight={800}>표시할 결과가 없습니다.</Typography></Paper>
      ) : grouped.map((section) => (
        <Stack key={section.key} spacing={1}>
          <Typography sx={{ fontSize: 16, fontWeight: 900 }}>{section.title}</Typography>
          <ResultTable rows={section.rows} threeSet={threeSet} />
        </Stack>
      ))}
    </Stack>
  );
}
