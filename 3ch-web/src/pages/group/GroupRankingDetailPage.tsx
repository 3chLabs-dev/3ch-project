import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Box,
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
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import type { PointRankingRow } from "../../features/group/groupApi";
import { useGetGroupPointRankingQuery } from "../../features/group/groupApi";

function parseYearParam(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default function GroupRankingDetailPage() {
  const { id: groupId = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialYear = useMemo(() => parseYearParam(searchParams.get("year")), [searchParams]);
  const [selectedYear, setSelectedYear] = useState<number | undefined>(initialYear);

  const { data, isLoading } = useGetGroupPointRankingQuery(
    { groupId, year: selectedYear, scope: "club" },
    { skip: !groupId },
  );

  const activeYear = selectedYear ?? data?.year ?? new Date().getFullYear();
  const yearOptions = data?.available_years?.length ? data.available_years : [activeYear];

  const handleYearChange = (value: number) => {
    setSelectedYear(value);
    setSearchParams({ year: String(value) });
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
          value={String(activeYear)}
          onChange={(event) => handleYearChange(Number(event.target.value))}
          sx={{ minWidth: 96, fontSize: 13, fontWeight: 700 }}
        >
          {yearOptions.map((year) => (
            <MenuItem key={year} value={String(year)} sx={{ fontSize: 13 }}>
              {year}년
            </MenuItem>
          ))}
        </Select>
      </Stack>

      <SectionTitle title="리그" />
      <ClubRankingTable
        rows={data.league.rankings}
        currentUserId={data.currentUserId}
        onSelect={(memberId) => navigate(`/club/${groupId}/member/${memberId}`)}
      />

      <SectionTitle title="대회" />
      <ClubRankingTable
        rows={data.tournament.rankings}
        currentUserId={data.currentUserId}
        onSelect={(memberId) => navigate(`/club/${groupId}/member/${memberId}`)}
      />
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
