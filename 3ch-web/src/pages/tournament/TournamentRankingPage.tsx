import { useRef, useState } from "react";
import { Alert, Box, Button, CircularProgress, IconButton, MenuItem, Select, Stack, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import { useNavigate, useParams } from "react-router-dom";
import CurvedShareIcon from "../../components/CurvedShareIcon";
import { LeagueRankingShareDialog, RankingSection, type LeagueRankingListRow } from "../league/LeaguePointRankingPage";
import { useGetTournamentQuery, useGetTournamentResultsQuery, type TournamentStanding } from "../../features/tournament/tournamentApi";

const rankingRows = (rows: TournamentStanding[], threeSet: boolean): LeagueRankingListRow[] => rows.map((row) => ({
  id: row.id, rank: row.rank, name: row.name, division: row.member_division, club_name: row.club_name,
  total_points: 0, result_parts: threeSet ? [{ value: row.sets_for, unit: "점" }] : [{ value: row.wins, unit: "승" }, { value: row.losses, unit: "패" }],
}));

export default function TournamentRankingPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error } = useGetTournamentResultsQuery(id);
  const { data: metadata } = useGetTournamentQuery(id);
  const [selectedDivision, setSelectedDivision] = useState("");
  const [visibleCount, setVisibleCount] = useState(10);
  const [downloading, setDownloading] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const exportRef = useRef<HTMLDivElement>(null);
  const divisions = data?.divisions ?? [];
  const division = divisions.find((entry) => entry.id === selectedDivision) ?? divisions[0];
  const round = [...division?.rounds ?? []].reverse().find((entry) => entry.complete) ?? division?.rounds[0];
  const threeSet = round?.rules.match_rule === "THREE_SET" || String(round?.rules.match_rule ?? "").includes("3세트");
  const sections = !round?.complete ? [] : round.brackets?.length
    ? round.brackets.map((entry) => ({ title: `${entry.name} 순위`, rows: entry.standings }))
    : round.pools.length ? round.pools.map((entry) => ({ title: `${entry.name}조`, rows: entry.standings }))
    : [{ title: division?.name ?? "전체 순위", rows: round.standings }];
  const download = async () => {
    if (!exportRef.current || downloading) return;
    setDownloading(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(exportRef.current, { scale: 2, useCORS: true, backgroundColor: "#FFFFFF" });
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `대회순위_${metadata?.tournament.title ?? ""}_${division?.name ?? ""}.png`;
      link.click();
    } catch { setNotice("순위 이미지를 저장하지 못했습니다."); }
    finally { setDownloading(false); }
  };
  if (isLoading) return <Box sx={{ p: 3, textAlign: "center" }}><CircularProgress /></Box>;
  if (error || !data) return <Alert severity="error">대회 순위를 불러오지 못했습니다.</Alert>;
  return <Box sx={{ maxWidth: 720, mx: "auto", p: 2, pb: 8 }}>
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
      <Button onClick={() => navigate(`/tournament/${id}`)} sx={{ minWidth: 36 }}><ArrowBackIcon /></Button>
      <Typography variant="h6" fontWeight={900} sx={{ flex: 1 }}>순위</Typography>
      {division && <Select size="small" value={division.id} onChange={(event) => { setSelectedDivision(event.target.value); setVisibleCount(10); }} sx={{ minWidth: 116, borderRadius: 2 }}>
        {divisions.map((entry) => <MenuItem key={entry.id} value={entry.id}>{entry.name}</MenuItem>)}
      </Select>}
    </Stack>
    <Stack direction="row" justifyContent="flex-end" spacing={0.5} sx={{ mb: 1.2 }}>
      <IconButton size="small" disabled={downloading || !sections.length} onClick={() => void download()} aria-label="대회 순위 이미지 다운로드" sx={{ border: "1px solid #D1D5DB", borderRadius: 1 }}><DownloadOutlinedIcon sx={{ fontSize: 18 }} /></IconButton>
      <IconButton size="small" onClick={() => setShareDialogOpen(true)} aria-label="대회 순위 공유" sx={{ border: "1px solid #D1D5DB", borderRadius: 1 }}><CurvedShareIcon sx={{ fontSize: 19 }} /></IconButton>
    </Stack>
    {notice && <Alert severity="info" onClose={() => setNotice("")} sx={{ mb: 2 }}>{notice}</Alert>}
    {round && <Typography sx={{ mb: 1.2, color: "text.secondary", fontSize: 12, fontWeight: 700 }}>{round.round_no}라운드 · {String(round.rules.round_label ?? "")}</Typography>}
    {!sections.length ? <Alert severity="info">아직 라운드가 종료되지 않았습니다.</Alert> : sections.map((section) => <RankingSection key={section.title} title={section.title} rows={rankingRows(section.rows, threeSet)} visibleCount={visibleCount} currentUserId={-1} onSelect={() => undefined} onMore={() => setVisibleCount((count) => count + 10)} />)}
    <LeagueRankingShareDialog open={shareDialogOpen} onClose={() => setShareDialogOpen(false)}
      link={`${window.location.origin}/tournament/${id}/ranking`} leagueName={metadata?.tournament.title ?? ""}
      seasonName={division?.name ?? ""} resourceLabel="대회" hideVisibility visibility="public" canManage={false}
      savingVisibility={false} onVisibilityChange={async () => undefined} />
    <Box ref={exportRef} sx={{ position: "fixed", left: -10000, top: 0, width: 430, bgcolor: "#FFF", p: 2.5, zIndex: -1 }}>
      <Typography sx={{ fontSize: 22, fontWeight: 900 }}>{metadata?.tournament.title} 순위</Typography>
      <Typography sx={{ mt: 0.4, mb: 2, color: "#6B7280", fontSize: 13, fontWeight: 700 }}>{division?.name}</Typography>
      {sections.map((section) => <RankingSection key={section.title} title={section.title} rows={rankingRows(section.rows, threeSet)} visibleCount={Number.MAX_SAFE_INTEGER} currentUserId={-1} onSelect={() => undefined} onMore={() => undefined} />)}
    </Box>
  </Box>;
}
