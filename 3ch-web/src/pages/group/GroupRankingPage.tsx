import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import type { PointRankingRow } from "../../features/group/groupApi";
import { useGetGroupPointRankingQuery } from "../../features/group/groupApi";
import GroupRankingSeasonDialog from "./GroupRankingSeasonDialog";

export default function GroupRankingPage() {
  const { id: groupId = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | undefined>(undefined);
  const [seasonDialogOpen, setSeasonDialogOpen] = useState(false);

  const { data, isLoading } = useGetGroupPointRankingQuery(
    { groupId, year: selectedYear, seasonId: selectedSeasonId, scope: "club" },
    { skip: !groupId },
  );

  const activeYear = selectedYear ?? data?.year ?? new Date().getFullYear();
  const yearOptions = data?.available_years?.length ? data.available_years : [activeYear];
  const activeSelectValue = selectedSeasonId
    ? `season:${selectedSeasonId}`
    : selectedYear
      ? `year:${selectedYear}`
      : data?.no_active_season
        ? "inactive"
      : data?.season_id
        ? `season:${data.season_id}`
        : `year:${activeYear}`;
  const canManage = data?.myRole === "owner";

  const handleOpenDetail = () => {
    const seasonId = selectedSeasonId ?? data?.season_id;
    navigate(`/club/${groupId}/ranking/detail?${seasonId ? `season=${seasonId}` : `year=${activeYear}`}`);
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
        <IconButton onClick={() => navigate(-1)} size="small">
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
          {yearOptions.map((year) => (
            <MenuItem key={year} value={`year:${year}`} sx={{ fontSize: 13 }}>
              {year}년
            </MenuItem>
          ))}
        </Select>
        {canManage && <Button size="small" variant="outlined" onClick={() => setSeasonDialogOpen(true)} sx={{ minWidth: 72, color: "#111827", borderColor: "#D1D5DB", fontWeight: 800 }}>기간 설정</Button>}
      </Stack>

      <SectionHeader title="리그" onOpenDetail={handleOpenDetail} />
      <PointRankingList rows={data.league.rankings} currentUserId={data.currentUserId} />

      <SectionHeader title="대회" onOpenDetail={handleOpenDetail} />
      <PointRankingList rows={data.tournament.rankings} currentUserId={data.currentUserId} />
      <GroupRankingSeasonDialog open={seasonDialogOpen} groupId={groupId} onClose={() => setSeasonDialogOpen(false)} onCreated={(seasonId) => { setSelectedSeasonId(seasonId); setSelectedYear(undefined); }} />
    </Stack>
  );
}

function SectionHeader({
  title,
  onOpenDetail,
}: {
  title: string;
  onOpenDetail: () => void;
}) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
      <Typography fontWeight={900} fontSize={18}>
        {title}
      </Typography>
      <Button
        size="small"
        variant="outlined"
        onClick={onOpenDetail}
        sx={{
          minWidth: "auto",
          px: 1.5,
          py: 0.5,
          borderColor: "#D1D5DB",
          color: "#111827",
          fontSize: 12,
          fontWeight: 800,
        }}
      >
        자세히 보기
      </Button>
    </Stack>
  );
}

function PointRankingList({
  rows,
  currentUserId,
}: {
  rows: PointRankingRow[];
  currentUserId: number;
}) {
  if (rows.length === 0) {
    return <EmptyRankingCard />;
  }

  return (
    <Stack spacing={0.8}>
      {rows.map((row) => {
        const isMine = row.member_id === currentUserId;
        const rankBadgeBg =
          row.rank === 1 ? "#F4C542" :
          row.rank === 2 ? "#D9DEE7" :
          row.rank === 3 ? "#D89A5B" :
          "#F3F4F6";
        const rankBadgeColor = row.rank && row.rank <= 3 ? "#111827" : "#6B7280";

        return (
          <Card
            key={row.member_id}
            elevation={2}
            sx={{
              borderRadius: 0.85,
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              bgcolor: isMine ? "#EEF2FF" : "#FFF",
            }}
          >
            <CardContent sx={{ py: 0.95, px: 1.3, "&:last-child": { pb: 0.95 } }}>
              <Stack direction="row" alignItems="center" spacing={0.75}>
                <Box
                  sx={{
                    minWidth: 28,
                    height: 28,
                    borderRadius: 999,
                    bgcolor: rankBadgeBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 900,
                    fontSize: 11,
                    color: rankBadgeColor,
                    flexShrink: 0,
                  }}
                >
                  {row.rank ?? "-"}
                </Box>

                {row.division && (
                  <Box
                    sx={{
                      minWidth: 28,
                      height: 28,
                      px: 0.55,
                      borderRadius: 999,
                      bgcolor: "#FDBA4D",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 900,
                      fontSize: 10,
                      color: "#111827",
                      flexShrink: 0,
                    }}
                  >
                    {row.division}
                  </Box>
                )}

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
