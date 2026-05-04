import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Chip,
  CircularProgress,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import { useAppSelector } from "../../app/hooks";
import type { PointRankingRow } from "../../features/group/groupApi";

type ScopeValue = "club" | "national";

type ClubOption = {
  id: string;
  name: string;
  sport?: string | null;
};

type AdminPointRankingResponse = {
  ok: boolean;
  group: { id: string; name: string; sport?: string | null };
  year: number;
  scope: ScopeValue;
  available_years: number[];
  league: { rankings: PointRankingRow[] };
  tournament: { rankings: PointRankingRow[] };
};

const SCOPE_OPTIONS: Array<{ value: ScopeValue; label: string }> = [
  { value: "club", label: "내 클럽" },
  { value: "national", label: "전국 클럽" },
];

export default function AdminRankingPage() {
  const token = useAppSelector((s) => s.admin.token) ?? "";

  const [clubs, setClubs] = useState<ClubOption[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [scope, setScope] = useState<ScopeValue>("club");
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined);
  const [loadingClubs, setLoadingClubs] = useState(false);
  const [loadingRanking, setLoadingRanking] = useState(false);
  const [ranking, setRanking] = useState<AdminPointRankingResponse | null>(null);

  const fetchClubs = useCallback(async () => {
    if (!token) return;
    setLoadingClubs(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/clubs-list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        const nextClubs = Array.isArray(data.clubs) ? data.clubs : [];
        setClubs(nextClubs);
        setSelectedGroupId((prev) => prev || nextClubs[0]?.id || "");
      }
    } finally {
      setLoadingClubs(false);
    }
  }, [token]);

  const fetchRanking = useCallback(async () => {
    if (!token || !selectedGroupId) return;
    setLoadingRanking(true);
    try {
      const params = new URLSearchParams({
        group_id: selectedGroupId,
        scope,
      });
      if (selectedYear) {
        params.set("year", String(selectedYear));
      }

      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/rankings/points?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setRanking(data);
      } else {
        setRanking(null);
      }
    } finally {
      setLoadingRanking(false);
    }
  }, [scope, selectedGroupId, selectedYear, token]);

  useEffect(() => {
    fetchClubs();
  }, [fetchClubs]);

  useEffect(() => {
    fetchRanking();
  }, [fetchRanking]);

  const activeYear = selectedYear ?? ranking?.year ?? new Date().getFullYear();
  const yearOptions = useMemo(() => {
    if (ranking?.available_years?.length) {
      return ranking.available_years;
    }
    return [activeYear];
  }, [activeYear, ranking?.available_years]);

  const selectedClub = useMemo(
    () => clubs.find((club) => club.id === selectedGroupId) ?? null,
    [clubs, selectedGroupId],
  );

  return (
    <Box sx={{ p: 3 }}>
      <Typography sx={{ fontSize: 18, fontWeight: 900, mb: 2, color: "#1F2937" }}>
        랭킹 관리
      </Typography>

      <Box
        sx={{
          border: "1px solid #E5E7EB",
          borderRadius: 1.5,
          px: 2.5,
          py: 2,
          mb: 2.5,
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 120px 120px" },
            columnGap: 1.5,
            rowGap: 1.25,
            alignItems: "end",
          }}
        >
        <FilterField label="클럽">
          <Select
            size="small"
            fullWidth
            value={selectedGroupId}
            onChange={(event: SelectChangeEvent) => {
              setSelectedGroupId(event.target.value);
              setSelectedYear(undefined);
            }}
            sx={{ fontSize: 12, height: 36 }}
            disabled={loadingClubs || clubs.length === 0}
          >
            {clubs.map((club) => (
              <MenuItem key={club.id} value={club.id} sx={{ fontSize: 12 }}>
                {club.name} {club.sport ? `(${club.sport})` : ""}
              </MenuItem>
            ))}
          </Select>
        </FilterField>

        <FilterField label="연도">
          <Select
            size="small"
            fullWidth
            value={String(activeYear)}
            onChange={(event: SelectChangeEvent) => setSelectedYear(Number(event.target.value))}
            sx={{ fontSize: 12, height: 36 }}
            disabled={!ranking}
          >
            {yearOptions.map((year) => (
              <MenuItem key={year} value={String(year)} sx={{ fontSize: 12 }}>
                {year}년
              </MenuItem>
            ))}
          </Select>
        </FilterField>

        <FilterField label="범위">
          <Select
            size="small"
            fullWidth
            value={scope}
            onChange={(event: SelectChangeEvent<ScopeValue>) => setScope(event.target.value as ScopeValue)}
            sx={{ fontSize: 12, height: 36 }}
          >
            {SCOPE_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value} sx={{ fontSize: 12 }}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FilterField>

        </Box>

        <Box sx={{ pt: 1.25 }}>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip
              label={selectedClub ? `기준 클럽 ${selectedClub.name}` : "기준 클럽 미선택"}
              size="small"
              sx={{ fontWeight: 700 }}
            />
            {selectedClub?.sport && (
              <Chip label={`종목 ${selectedClub.sport}`} size="small" sx={{ fontWeight: 700 }} />
            )}
            <Chip label={scope === "club" ? "클럽 내부 순위" : "선택 종목 전국 순위"} size="small" sx={{ fontWeight: 700 }} />
          </Stack>
        </Box>
      </Box>

      {loadingRanking ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress size={30} />
        </Box>
      ) : !selectedGroupId ? (
        <EmptyState message="조회할 클럽이 없습니다." />
      ) : !ranking ? (
        <EmptyState message="랭킹 정보를 불러오지 못했습니다." />
      ) : (
        <Stack spacing={2.5}>
          <RankingSection title="리그" rows={ranking.league.rankings} />
          <RankingSection title="대회" rows={ranking.tournament.rankings} />
        </Stack>
      )}
    </Box>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Stack spacing={0.7}>
      <Typography
        sx={{
          fontSize: 12,
          fontWeight: 700,
          color: "#374151",
          whiteSpace: "nowrap",
          lineHeight: 1.2,
        }}
      >
        {label}
      </Typography>
      <Box sx={{ minWidth: 0 }}>{children}</Box>
    </Stack>
  );
}

function RankingSection({ title, rows }: { title: string; rows: PointRankingRow[] }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 16, fontWeight: 900, color: "#111827", mb: 1.25 }}>
        {title}
      </Typography>
      <Box sx={{ border: "1px solid #E5E7EB", borderRadius: 1.5, overflow: "hidden" }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "#F9FAFB" }}>
              {["순위", "이름", "부수", "참가", "우승", "경기", "승", "패", "참가점수", "경기점수", "보너스", "총점"].map((label) => (
                <TableCell key={label} sx={{ fontWeight: 800, fontSize: 12, color: "#374151", py: 1.2 }}>
                  {label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} align="center" sx={{ py: 5, color: "#9CA3AF", fontSize: 13, fontWeight: 700 }}>
                  집계된 순위가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={`${title}-${row.member_id}`} hover>
                  <TableCell sx={{ fontSize: 12, fontWeight: 800 }}>{row.rank ?? "-"}</TableCell>
                  <TableCell sx={{ fontSize: 12, fontWeight: 700 }}>{row.name}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{row.division ?? "-"}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{row.attendance_count}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{row.championships}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{row.matches_played}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{row.wins}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{row.losses}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{row.attendance_points}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{row.score_points}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{row.bonus_points}</TableCell>
                  <TableCell sx={{ fontSize: 12, fontWeight: 900, color: "#1D4ED8" }}>{row.total_points}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Box>
    </Box>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Box
      sx={{
        border: "1px solid #E5E7EB",
        borderRadius: 1.5,
        py: 8,
        textAlign: "center",
        color: "#6B7280",
        fontWeight: 700,
        fontSize: 13,
      }}
    >
      {message}
    </Box>
  );
}
