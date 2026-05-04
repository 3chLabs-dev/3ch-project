import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  IconButton,
  MenuItem,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import type { PointRankingRow } from "../../features/group/groupApi";
import { useGetGroupPointRankingQuery } from "../../features/group/groupApi";

type ScopeValue = "club" | "national";

export default function GroupRankingPage() {
  const { id: groupId = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [scope, setScope] = useState<ScopeValue>("club");
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined);

  const { data, isLoading } = useGetGroupPointRankingQuery(
    { groupId, year: selectedYear, scope },
    { skip: !groupId },
  );

  const activeYear = selectedYear ?? data?.year ?? new Date().getFullYear();
  const yearOptions = data?.available_years?.length ? data.available_years : [activeYear];

  const handleScopeChange = (_event: React.MouseEvent<HTMLElement>, nextScope: ScopeValue | null) => {
    if (!nextScope) return;
    setScope(nextScope);
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
        <Typography color="text.secondary">순위 정보를 불러올 수 없습니다.</Typography>
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
          value={String(activeYear)}
          onChange={(event) => setSelectedYear(Number(event.target.value))}
          sx={{ minWidth: 96, fontSize: 13, fontWeight: 700 }}
        >
          {yearOptions.map((year) => (
            <MenuItem key={year} value={String(year)} sx={{ fontSize: 13 }}>
              {year}년
            </MenuItem>
          ))}
        </Select>
      </Stack>

      <ToggleButtonGroup
        exclusive
        value={scope}
        onChange={handleScopeChange}
        fullWidth
        sx={{
          bgcolor: "#F3F4F6",
          borderRadius: 999,
          p: 0.4,
          "& .MuiToggleButton-root": {
            border: "none",
            borderRadius: 999,
            fontWeight: 800,
            fontSize: 13,
            color: "#6B7280",
            py: 0.9,
          },
          "& .Mui-selected": {
            bgcolor: "#FFFFFF !important",
            color: "#111827 !important",
            boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
          },
        }}
      >
        <ToggleButton value="club">내 클럽</ToggleButton>
        <ToggleButton value="national">전국 클럽</ToggleButton>
      </ToggleButtonGroup>

      <SectionTitle title="리그" />
      {scope === "club" ? (
        <ClubRankingTable
          rows={data.league.rankings}
          currentUserId={data.currentUserId}
          onSelect={(memberId) => navigate(`/club/${groupId}/member/${memberId}`)}
        />
      ) : (
        <NationalRankingList
          rows={data.league.rankings}
          currentUserId={data.currentUserId}
          onSelect={(memberId) => navigate(`/club/${groupId}/member/${memberId}`)}
        />
      )}

      <SectionTitle title="대회" />
      {scope === "club" ? (
        <ClubRankingTable
          rows={data.tournament.rankings}
          currentUserId={data.currentUserId}
          onSelect={(memberId) => navigate(`/club/${groupId}/member/${memberId}`)}
        />
      ) : (
        <NationalRankingList
          rows={data.tournament.rankings}
          currentUserId={data.currentUserId}
          onSelect={(memberId) => navigate(`/club/${groupId}/member/${memberId}`)}
        />
      )}
    </Stack>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <Typography fontWeight={900} fontSize={18}>
      {title}
    </Typography>
  );
}

function ClubRankingTable({
  rows,
  currentUserId,
  onSelect,
}: {
  rows: PointRankingRow[];
  currentUserId: number;
  onSelect: (memberId: number) => void;
}) {
  if (rows.length === 0) {
    return <EmptyRankingCard />;
  }

  return (
    <Card elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
      <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "44px minmax(82px,1fr) 36px 36px 40px 32px 32px 48px",
            px: 1.5,
            py: 1.2,
            bgcolor: "#F9FAFB",
            borderBottom: "1px solid #E5E7EB",
            columnGap: 0.5,
          }}
        >
          {["순위", "이름", "참석", "우승", "경기", "승", "패", "승률"].map((label) => (
            <Typography key={label} sx={{ fontSize: 11, fontWeight: 800, color: "#6B7280", textAlign: "center" }}>
              {label}
            </Typography>
          ))}
        </Box>

        {rows.map((row) => {
          const isMine = row.member_id === currentUserId;
          return (
            <Box
              key={row.member_id}
              onClick={() => onSelect(row.member_id)}
              sx={{
                display: "grid",
                gridTemplateColumns: "44px minmax(82px,1fr) 36px 36px 40px 32px 32px 48px",
                px: 1.5,
                py: 1.25,
                columnGap: 0.5,
                alignItems: "center",
                borderBottom: "1px solid #F3F4F6",
                bgcolor: isMine ? "#EEF4FF" : "#FFF",
                cursor: "pointer",
              }}
            >
              <Typography sx={{ fontSize: 12, fontWeight: 900, textAlign: "center" }}>{row.rank ?? "-"}</Typography>
              <Stack direction="row" alignItems="center" spacing={0.6} sx={{ minWidth: 0 }}>
                {row.rank === 1 && <EmojiEventsOutlinedIcon sx={{ color: "#EAB308", fontSize: 14 }} />}
                <Typography
                  sx={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: isMine ? "#1D4ED8" : "#111827",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.name}
                </Typography>
              </Stack>
              <CellValue value={row.attendance_count} />
              <CellValue value={row.championships} />
              <CellValue value={row.matches_played} />
              <CellValue value={row.wins} />
              <CellValue value={row.losses} />
              <CellValue value={row.win_rate.toFixed(3)} />
            </Box>
          );
        })}
      </CardContent>
    </Card>
  );
}

function NationalRankingList({
  rows,
  currentUserId,
  onSelect,
}: {
  rows: PointRankingRow[];
  currentUserId: number;
  onSelect: (memberId: number) => void;
}) {
  if (rows.length === 0) {
    return <EmptyRankingCard />;
  }

  const topRows = rows.slice(0, 10);
  const myRow = rows.find((row) => row.member_id === currentUserId) ?? null;
  const shouldPinMyRow = !!myRow && myRow.rank != null && myRow.rank > 10;
  const listRows = shouldPinMyRow ? [...topRows, myRow] : topRows;

  return (
    <Stack spacing={0.6}>
      {listRows.map((row, index) => {
        const isPinnedMine = shouldPinMyRow && index === listRows.length - 1;
        const rankBadgeBg =
          row.rank === 1 ? "#F4C542" :
          row.rank === 2 ? "#D9DEE7" :
          row.rank === 3 ? "#D89A5B" :
          "#F3F4F6";
        const rankBadgeColor =
          row.rank && row.rank <= 3 ? "#111827" : "#6B7280";
        return (
          <Card
            key={`${row.member_id}-${isPinnedMine ? "mine" : "row"}`}
            elevation={2}
            onClick={() => onSelect(row.member_id)}
            sx={{
              borderRadius: 0.85,
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              cursor: "pointer",
              bgcolor: row.member_id === currentUserId ? "#EEF2FF" : "#FFF",
              border: isPinnedMine ? "1px solid #C7D2FE" : "1px solid transparent",
            }}
          >
            <CardContent sx={{ py: 0.95, px: 1.3, "&:last-child": { pb: 0.95 } }}>
              <Stack direction="row" alignItems="center" spacing={0.75}>
                <Box
                  sx={{
                    minWidth: 24,
                    height: 24,
                    borderRadius: 999,
                    bgcolor: rankBadgeBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 900,
                    fontSize: 10.5,
                    color: rankBadgeColor,
                  }}
                >
                  {row.rank ?? "-"}
                </Box>

                {row.division && (
                  <Box
                    sx={{
                      minWidth: 24,
                      height: 24,
                      px: 0.55,
                      borderRadius: 999,
                      bgcolor: "#FDBA4D",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 900,
                      fontSize: 9.5,
                      color: "#111827",
                    }}
                  >
                    {row.division}
                  </Box>
                )}

                <Typography
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 13.5,
                    fontWeight: 900,
                    color: row.member_id === currentUserId ? "#1D4ED8" : "#111827",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.name}
                </Typography>

                <Box sx={{ textAlign: "right", minWidth: 38 }}>
                  <Typography sx={{ fontSize: 15, fontWeight: 900, color: "#1D4ED8", lineHeight: 1 }}>
                    {row.total_points}
                  </Typography>
                  <Typography sx={{ fontSize: 9.5, color: "text.secondary", fontWeight: 700, lineHeight: 1 }}>
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

function CellValue({ value }: { value: string | number }) {
  return (
    <Typography sx={{ fontSize: 12, fontWeight: 800, textAlign: "center", color: "#111827" }}>
      {value}
    </Typography>
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
