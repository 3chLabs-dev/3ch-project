import { useRef, useState } from "react";
import { DivisionBadge } from "../../components/ParticipantName";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LanguageIcon from "@mui/icons-material/Language";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import SmsOutlinedIcon from "@mui/icons-material/SmsOutlined";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import QRCode from "react-qr-code";
import CurvedShareIcon from "../../components/CurvedShareIcon";
import type { PointRankingRow, ThemeRankingRow } from "../../features/group/groupApi";
import { useGetGroupPointRankingQuery, useUpdateGroupRankingVisibilityMutation } from "../../features/group/groupApi";

export default function GroupRankingPage() {
  const { id: groupId = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const backMode = searchParams.get("back");
  const backTo = backMode === "manage"
    ? `/club/${groupId}/manage`
    : backMode === "ranking"
      ? "/ranking"
      : `/club/${groupId}`;
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | undefined>(searchParams.get("season") ?? undefined);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [rankingTab, setRankingTab] = useState("league");
  const [isDownloading, setIsDownloading] = useState(false);
  const [updateRankingVisibility, visibilityState] = useUpdateGroupRankingVisibilityMutation();
  const exportRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useGetGroupPointRankingQuery(
    { groupId, year: selectedYear, seasonId: selectedSeasonId, scope: "club" },
    { skip: !groupId },
  );

  const activeYear = selectedYear ?? data?.year ?? new Date().getFullYear();
  const yearOptions = data?.available_years?.length ? data.available_years : [activeYear];
  const standaloneYearOptions = yearOptions.filter((year) => !data?.seasons.some(
    (season) => season.is_default && season.start_date.startsWith(`${year}-`),
  ));
  const activeSelectValue = selectedSeasonId
    ? `season:${selectedSeasonId}`
    : selectedYear
      ? `year:${selectedYear}`
      : data?.no_active_season
        ? "inactive"
      : data?.season_id
        ? `season:${data.season_id}`
        : `year:${activeYear}`;
  const canManage = data?.myRole === "owner"
    || (data?.myRole === "admin" && data.myPermissions?.ranking === true);

  const handleOpenDetail = () => {
    const seasonId = selectedSeasonId ?? data?.season_id;
    navigate(`/club/${groupId}/ranking/detail?${seasonId ? `season=${seasonId}` : `year=${activeYear}`}`);
  };

  const appUrl = String(import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/$/, "");
  const rankingShareUrl = `${appUrl}/club/${groupId}/ranking${data?.season_id ? `?season=${encodeURIComponent(selectedSeasonId ?? data.season_id)}` : ""}`;

  const handleDownloadRanking = async () => {
    if (!exportRef.current || isDownloading) return;
    setIsDownloading(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(exportRef.current, { scale: 2, useCORS: true, backgroundColor: "#FFFFFF" });
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `클럽순위_${data?.group.name ?? "클럽"}_${data?.season?.name ?? activeYear}.png`;
      link.click();
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!data) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <Typography color="text.secondary">순위 정보를 불러오지 못했습니다.</Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={2.5} sx={{ pb: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <IconButton onClick={() => navigate(backTo)} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" fontWeight={900} flex={1}>
          순위
        </Typography>
        <Select
          size="small"
          value={activeSelectValue}
          onChange={(event) => {
            const [kind, value] = String(event.target.value).split(":");
            if (kind === "season") {
              setSelectedSeasonId(value);
              setSelectedYear(undefined);
            } else {
              setSelectedYear(Number(value));
              setSelectedSeasonId(undefined);
            }
          }}
          sx={{ minWidth: 118, fontSize: 13, fontWeight: 700 }}
        >
          {data.no_active_season && <MenuItem value="inactive" disabled sx={{ fontSize: 13 }}>현재 시즌 없음</MenuItem>}
          {data.seasons.map((season) => (
            <MenuItem key={season.id} value={`season:${season.id}`} sx={{ fontSize: 13 }}>{season.name}</MenuItem>
          ))}
          {standaloneYearOptions.map((year) => (
            <MenuItem key={year} value={`year:${year}`} sx={{ fontSize: 13 }}>
              {year}년
            </MenuItem>
          ))}
        </Select>
        {canManage && (
          <Button
            size="small"
            variant="outlined"
            onClick={() => navigate(`/club/${groupId}/ranking/seasons`)}
            aria-label="시즌 설정"
            title="시즌 설정"
            sx={{ borderRadius: 1, minWidth: 0, px: 1.25, whiteSpace: "nowrap", fontWeight: 800 }}
          >
            시즌 설정
          </Button>
        )}
      </Stack>

      <Tabs
        value={rankingTab}
        onChange={(_event, value) => setRankingTab(value)}
        variant="scrollable"
        scrollButtons={false}
        sx={{
          mx: -2,
          px: 2,
          minHeight: 42,
          borderBottom: "1px solid #E5E7EB",
          "& .MuiTab-root": { minHeight: 42, minWidth: "auto", px: 1.5, fontSize: 13, fontWeight: 800, color: "#6B7280" },
          "& .Mui-selected": { color: "#2563EB" },
          "& .MuiTabs-indicator": { height: 3, borderRadius: "3px 3px 0 0" },
        }}
      >
        <Tab value="league" label="시즌" />
        <Tab value="attendance" label="참가상" />
        <Tab value="championships" label="상위부 우승" />
        <Tab value="lower_championships" label="하위부 우승" />
        <Tab value="wins" label="다승" />
        <Tab value="set_ratio" label="세트득실" />
        <Tab value="runners_up" label="아차상" />
        <Tab value="prelim_firsts" label="예선왕" />
      </Tabs>

      {rankingTab === "league" ? <>
        <SectionHeader
          title="리그"
          onOpenDetail={handleOpenDetail}
          onDownload={handleDownloadRanking}
          onShare={() => setShareDialogOpen(true)}
          isDownloading={isDownloading}
        />
        <PointRankingList
          rows={data.league.rankings}
          currentUserId={data.currentUserId}
          onSelect={(memberId) => navigate(`/club/${groupId}/member/${memberId}`)}
        />

        <SectionHeader title="대회" onOpenDetail={handleOpenDetail} />
        <PointRankingList
          rows={data.tournament.rankings}
          currentUserId={data.currentUserId}
          onSelect={(memberId) => navigate(`/club/${groupId}/member/${memberId}`)}
        />
      </> : (
        <ThemeRankingPanel
          key={rankingTab}
          theme={rankingTab}
          rows={data.themes?.[rankingTab as keyof typeof data.themes] ?? []}
          currentUserId={data.currentUserId}
          onSelect={(memberId) => navigate(`/club/${groupId}/member/${memberId}`)}
        />
      )}

      <Box ref={exportRef} sx={{ position: "fixed", left: -10000, top: 0, width: 430, bgcolor: "#FFF", p: 2.5, zIndex: -1 }}>
        <Typography sx={{ fontSize: 22, fontWeight: 900 }}>{data.group.name} 클럽 순위</Typography>
        <Typography sx={{ mt: 0.4, mb: 2, color: "#6B7280", fontSize: 13, fontWeight: 700 }}>
          {data.season?.name ?? `${activeYear}년`}
        </Typography>
        <PointRankingList rows={data.league.rankings} currentUserId={data.currentUserId} onSelect={() => undefined} showAll />
      </Box>

      <RankingShareDialog
        open={shareDialogOpen}
        onClose={() => setShareDialogOpen(false)}
        link={rankingShareUrl}
        clubName={data.group.name}
        seasonName={data.season?.name ?? `${activeYear}년`}
        visibility={data.ranking_visibility}
        canManage={canManage}
        savingVisibility={visibilityState.isLoading}
        onVisibilityChange={async (visibility) => {
          try {
            await updateRankingVisibility({ groupId, visibility }).unwrap();
          } catch {
            window.alert("열람 권한을 변경하지 못했습니다.");
          }
        }}
      />
    </Stack>
  );
}

function SectionHeader({
  title,
  onOpenDetail,
  onDownload,
  onShare,
  isDownloading = false,
}: {
  title: string;
  onOpenDetail: () => void;
  onDownload?: () => void;
  onShare?: () => void;
  isDownloading?: boolean;
}) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
      <Typography fontWeight={900} fontSize={18}>
        {title}
      </Typography>
      <Stack direction="row" spacing={0.5} alignItems="center">
        {onDownload && <IconButton size="small" disabled={isDownloading} onClick={onDownload} aria-label="순위 이미지 다운로드" sx={{ border: "1px solid #D1D5DB", borderRadius: 1 }}><DownloadOutlinedIcon sx={{ fontSize: 18 }} /></IconButton>}
        {onShare && <IconButton size="small" onClick={onShare} aria-label="순위 공유" sx={{ border: "1px solid #D1D5DB", borderRadius: 1 }}><CurvedShareIcon sx={{ fontSize: 19 }} /></IconButton>}
        <Button
          size="small"
          variant="outlined"
          onClick={onOpenDetail}
          sx={{ minWidth: "auto", px: 1.5, py: 0.5, borderColor: "#D1D5DB", color: "#111827", fontSize: 12, fontWeight: 800 }}
        >
          자세히 보기
        </Button>
      </Stack>
    </Stack>
  );
}

const THEME_META: Record<string, { title: string; description: string; suffix: string }> = {
  attendance: { title: "참가상", description: "시즌 중 가장 많은 리그에 참가한 횟수 순위", suffix: "회" },
  championships: { title: "상위부 우승", description: "마지막 라운드 상위부 우승 횟수 순위", suffix: "회" },
  lower_championships: { title: "하위부 우승", description: "하위부 우승 횟수 순위", suffix: "회" },
  wins: { title: "다승왕", description: "개별 경기에서 기록한 승리 횟수 순위", suffix: "승" },
  set_ratio: { title: "세트득실왕", description: "개별 경기에서 기록한 세트 득실률 순위", suffix: "%" },
  runners_up: { title: "아차상", description: "마지막 라운드 상위부 준우승 횟수 순위", suffix: "회" },
  prelim_firsts: { title: "예선왕", description: "예선 풀리그·조별리그 1위 횟수 순위", suffix: "회" },
};

function ThemeRankingPanel({ theme, rows, currentUserId, onSelect }: { theme: string; rows: ThemeRankingRow[]; currentUserId: number; onSelect: (memberId: number) => void }) {
  const [visibleCount, setVisibleCount] = useState(10);
  const meta = THEME_META[theme] ?? THEME_META.attendance;
  const topRank = rows[0]?.rank;
  const winner = rows
    .filter((row) => row.rank === topRank)
    .reduce<ThemeRankingRow | undefined>((selected, row) => {
      if (!selected) return row;
      const divisionNumber = (division?: string | null) => {
        const parsed = Number.parseInt(String(division ?? "").replace(/[^0-9]/g, ""), 10);
        return Number.isFinite(parsed) ? parsed : -1;
      };
      return divisionNumber(row.division) > divisionNumber(selected.division) ? row : selected;
    }, undefined);
  const remainingRows = winner ? rows.filter((row) => row !== winner) : rows;
  const valueLabel = (row: ThemeRankingRow) => `${theme === "set_ratio" ? row.value.toFixed(1) : row.value}${meta.suffix}`;
  if (!winner) {
    return <Stack spacing={0.5}><Typography sx={{ fontSize: 18, fontWeight: 900 }}>{meta.title}</Typography><Typography sx={{ fontSize: 12, color: "text.secondary", fontWeight: 700 }}>{meta.description}</Typography><EmptyRankingCard /></Stack>;
  }
  return (
    <Box sx={{ bgcolor: "#EAF1FA", borderRadius: 2, p: 1.5 }}>
      <Typography sx={{ fontSize: 18, fontWeight: 900 }}>{meta.title}</Typography>
      <Typography sx={{ mb: 1.5, fontSize: 12, color: "#64748B", fontWeight: 700 }}>{meta.description}</Typography>
      <Card elevation={0} onClick={() => winner.member_id != null && onSelect(winner.member_id)} sx={{ mb: 1, borderRadius: 1.5, cursor: winner.member_id != null ? "pointer" : "default", border: "1px solid #D8E3F0" }}>
        <CardContent sx={{ py: 2, px: 2, "&:last-child": { pb: 2 } }}>
          <Stack alignItems="center" spacing={0.6}>
            <Box sx={{ width: 36, height: 36, borderRadius: "50%", bgcolor: "#FFC94A", color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 3px 8px rgba(217,160,0,.28)" }}><EmojiEventsOutlinedIcon sx={{ fontSize: 21 }} /></Box>
            <Stack direction="row" spacing={0.55} alignItems="center"><Typography sx={{ fontSize: 18, fontWeight: 900 }}>{winner.name}</Typography><DivisionBadge division={winner.division} /></Stack>
            {winner.is_pre_registered && <Typography sx={{ fontSize: 9, fontWeight: 800, color: "#64748B" }}>사전등록</Typography>}
            <Typography sx={{ fontSize: 22, lineHeight: 1, color: "#2878F0", fontWeight: 900 }}>{valueLabel(winner)}</Typography>
            {theme === "set_ratio" && <Typography sx={{ fontSize: 10, color: "#64748B", fontWeight: 700 }}>{winner.matches_played}경기 · {winner.sets_for}/{winner.sets_against}세트</Typography>}
          </Stack>
        </CardContent>
      </Card>
      <Stack spacing={0.7}>
        {remainingRows.slice(0, Math.max(0, visibleCount - 1)).map((row) => {
          const isMine = row.member_id != null && row.member_id === currentUserId;
          return <Card key={row.member_id ?? `pre-${row.pre_member_id}`} elevation={0} onClick={() => row.member_id != null && onSelect(row.member_id)} sx={{ borderRadius: 1.2, cursor: row.member_id != null ? "pointer" : "default", bgcolor: isMine ? "#EEF2FF" : "#FFF", border: "1px solid #DCE5F0" }}>
            <CardContent sx={{ py: 1, px: 1.25, "&:last-child": { pb: 1 } }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography sx={{ width: 22, textAlign: "center", color: "#64748B", fontSize: 13, fontWeight: 900 }}>{row.rank}</Typography>
                <Box sx={{ flex: 1, minWidth: 0 }}><Stack direction="row" alignItems="center" spacing={0.5}><Typography sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: isMine ? "#1D4ED8" : "#111827", fontSize: 14, fontWeight: 900 }}>{row.name}</Typography><DivisionBadge division={row.division} />{row.is_pre_registered && <Typography sx={{ fontSize: 9, color: "#64748B", fontWeight: 800 }}>사전등록</Typography>}</Stack>{theme === "set_ratio" && <Typography sx={{ mt: 0.15, fontSize: 9.5, color: "#94A3B8", fontWeight: 700 }}>{row.matches_played}경기 · {row.sets_for}/{row.sets_against}세트</Typography>}</Box>
                <Typography sx={{ color: "#2878F0", fontSize: 17, fontWeight: 900 }}>{valueLabel(row)}</Typography>
              </Stack>
            </CardContent>
          </Card>;
        })}
        {visibleCount < rows.length && <Button variant="outlined" endIcon={<ExpandMoreIcon />} onClick={() => setVisibleCount((count) => Math.min(count + 10, rows.length))} sx={{ bgcolor: "#FFF", borderColor: "#8AB8F8", color: "#2563EB", fontWeight: 900 }}>더보기</Button>}
      </Stack>
    </Box>
  );
}

function PointRankingList({
  rows,
  currentUserId,
  onSelect,
  showAll = false,
}: {
  rows: PointRankingRow[];
  currentUserId: number;
  onSelect: (memberId: number) => void;
  showAll?: boolean;
}) {
  const [visibleCount, setVisibleCount] = useState(10);
  if (rows.length === 0) {
    return <EmptyRankingCard />;
  }

  const visibleRows = showAll ? rows : rows.slice(0, visibleCount);
  const myRow = rows.find((row) => row.member_id === currentUserId);
  const showPinnedMine = !showAll && myRow && !visibleRows.includes(myRow);
  const displayRows = showPinnedMine ? [...visibleRows, myRow] : visibleRows;

  return (
    <Stack spacing={0.8}>
      {displayRows.map((row) => {
        const memberId = row.member_id;
        const isMine = memberId != null && memberId === currentUserId;
        const canOpenMember = memberId != null;
        const rankBadgeBg = row.rank === 1 ? "#E9C23B" : row.rank === 2 ? "#D1D5DB" : row.rank === 3 ? "#D6A348" : "#F3F4F6";
        const rankBadgeColor = row.rank && row.rank <= 3 ? "#FFF" : "#374151";

        return (
          <Card
            key={row.member_id ?? `pre-${row.pre_member_id}`}
            elevation={2}
            onClick={() => { if (memberId != null) onSelect(memberId); }}
            sx={{
              order: showPinnedMine && row === myRow ? 3 : 1,
              borderRadius: 0.85,
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              bgcolor: isMine ? "#EEF2FF" : "#FFF",
              cursor: canOpenMember ? "pointer" : "default",
              "&:hover": canOpenMember ? { bgcolor: isMine ? "#E0E7FF" : "#F9FAFB" } : undefined,
            }}
          >
            <CardContent sx={{ py: 0.95, px: 1.3, "&:last-child": { pb: 0.95 } }}>
              <Stack direction="row" alignItems="center" spacing={0.75}>
                <Box
                  sx={{
                    width: 42,
                    height: 30,
                    borderRadius: "5px 0 0 5px",
                    clipPath: "polygon(0 0, 100% 0, 82% 100%, 0 100%)",
                    bgcolor: rankBadgeBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 900,
                    fontSize: 13,
                    color: rankBadgeColor,
                    flexShrink: 0,
                  }}
                >
                  {row.rank ?? "-"}
                </Box>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Typography
                      sx={{
                        minWidth: 0,
                        fontSize: 13.5,
                        fontWeight: 900,
                        color: isMine ? "#1D4ED8" : "#111827",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {row.name}
                    </Typography>
                    <DivisionBadge division={row.division} />
                    {row.is_pre_registered && (
                      <Typography sx={{ fontSize: 9, fontWeight: 800, color: "#6B7280", whiteSpace: "nowrap" }}>
                        사전등록
                      </Typography>
                    )}
                  </Stack>
                </Box>

                <Box sx={{ textAlign: "right", minWidth: 52 }}>
                  <Typography sx={{ fontSize: 24, fontWeight: 900, color: "#1D4ED8", lineHeight: 1 }}>
                    {row.total_points}
                  </Typography>
                  <Typography sx={{ fontSize: 10, color: "text.secondary", fontWeight: 700, lineHeight: 1.1 }}>
                    포인트
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        );
      })}
      {!showAll && visibleCount < rows.length && (
        <Button
          variant="outlined"
          onClick={() => setVisibleCount((count) => Math.min(count + 10, rows.length))}
          endIcon={<ExpandMoreIcon />}
          sx={{ order: 2, bgcolor: "#FFF", borderColor: "#1976D2", color: "#1976D2", fontWeight: 900, py: 0.8 }}
        >
          더보기
        </Button>
      )}
    </Stack>
  );
}

function RankingShareDialog({ open, onClose, link, clubName, seasonName, visibility, canManage, savingVisibility, onVisibilityChange }: { open: boolean; onClose: () => void; link: string; clubName: string; seasonName: string; visibility: "public" | "club_only"; canManage: boolean; savingVisibility: boolean; onVisibilityChange: (visibility: "public" | "club_only") => Promise<void> }) {
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      window.alert("링크가 복사되었습니다.");
      onClose();
    } catch {
      window.alert("링크 복사에 실패했습니다.");
    }
  };
  const shareKakao = () => {
    const kakaoKey = import.meta.env.VITE_KAKAO_JS_KEY;
    if (window.Kakao && kakaoKey && !window.Kakao.isInitialized()) window.Kakao.init(kakaoKey);
    if (window.Kakao?.Share) {
      window.Kakao.Share.sendDefault({
        objectType: "feed",
        content: { title: `${clubName} 클럽 순위`, description: seasonName, imageUrl: `${new URL(link).origin}/og-image.png`, link: { mobileWebUrl: link, webUrl: link } },
        buttons: [{ title: "순위 보기", link: { mobileWebUrl: link, webUrl: link } }],
      });
    } else {
      void copyLink();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: 1, mx: 2 } } }}>
      <DialogTitle sx={{ fontWeight: 900 }}>클럽 순위 공유</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ pt: 1, alignItems: "center" }}>
          <Box sx={{ width: "100%" }}>
            <Typography fontSize={12} color="text.secondary" fontWeight={700} sx={{ mb: 0.8 }}>열람 권한</Typography>
            <ToggleButtonGroup
              value={visibility}
              exclusive
              disabled={!canManage || savingVisibility}
              onChange={(_event, value: "public" | "club_only" | null) => { if (value) void onVisibilityChange(value); }}
              size="small"
              fullWidth
              sx={{ "& .MuiToggleButton-root": { fontWeight: 700, fontSize: 13, py: 0.8 } }}
            >
              <ToggleButton value="club_only" sx={{ gap: 0.5 }}><LockOutlinedIcon sx={{ fontSize: 16 }} />클럽에 가입한 회원만</ToggleButton>
              <ToggleButton value="public" sx={{ gap: 0.5 }}><LanguageIcon sx={{ fontSize: 16 }} />링크가 있는 모든 사람</ToggleButton>
            </ToggleButtonGroup>
          </Box>
          <Box sx={{ p: 2, bgcolor: "#FFF", borderRadius: 1, border: "1px solid #E0E0E0" }}>
            <QRCode value={link} size={200} style={{ height: "auto", maxWidth: "100%", width: "100%" }} />
          </Box>
          <Box sx={{ width: "100%" }}>
            <Typography fontSize={12} color="text.secondary" fontWeight={700} sx={{ mb: 0.6 }}>공유 링크</Typography>
            <TextField value={link} fullWidth size="small" slotProps={{ input: { readOnly: true } }} />
          </Box>
          <Stack direction="row" justifyContent="space-around" sx={{ width: "100%" }}>
            <ShareAction label="카카오톡" bgcolor="#FFEB3A" onClick={shareKakao}><Box component="img" src="/kakao-logo.png" alt="카카오톡" sx={{ width: 38, height: 38 }} /></ShareAction>
            <ShareAction label="문자" bgcolor="#4CAF50" color="#FFF" onClick={() => { window.location.href = `sms:?body=${encodeURIComponent(`${clubName} 클럽 순위 (${seasonName}) ${link}`)}`; }}><SmsOutlinedIcon /></ShareAction>
            <ShareAction label="링크 복사" bgcolor="#E5E7EB" color="#374151" onClick={() => { void copyLink(); }}><ContentCopyOutlinedIcon /></ShareAction>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}><Button variant="contained" onClick={onClose} sx={{ fontWeight: 800 }}>닫기</Button></DialogActions>
    </Dialog>
  );
}

function ShareAction({ label, bgcolor, color, onClick, children }: { label: string; bgcolor: string; color?: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Stack alignItems="center" spacing={0.7}>
      <IconButton onClick={onClick} sx={{ width: 56, height: 56, bgcolor, color, "&:hover": { bgcolor } }}>{children}</IconButton>
      <Typography fontSize={11} fontWeight={700} color="text.secondary">{label}</Typography>
    </Stack>
  );
}

function EmptyRankingCard() {
  return (
    <Card elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
      <CardContent sx={{ py: 4, px: 2, "&:last-child": { pb: 4 } }}>
        <Typography textAlign="center" color="text.secondary" fontWeight={700}>
          아직 집계된 순위가 없습니다.
        </Typography>
      </CardContent>
    </Card>
  );
}
