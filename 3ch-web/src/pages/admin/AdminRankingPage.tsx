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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import { useAppSelector } from "../../app/hooks";
import type { PointRankingRow } from "../../features/group/groupApi";

type ScopeValue = "club" | "national";
type RankingMode = "point" | "rating";

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

type RatingRankingRow = {
  member_id: number;
  name: string;
  division?: string | null;
  rank: number | null;
  rating: number;
  wins: number;
  losses: number;
  matches_played: number;
  win_rate: number;
  streak: number;
  last_match_at?: string | null;
};

type AdminRatingRankingResponse = {
  ok: boolean;
  scope: ScopeValue;
  group?: { id: string; name: string; sport?: string | null };
  sport?: string;
  summary: {
    member_count?: number;
    ranked_count: number;
    match_count: number;
    updated_at?: string | null;
  };
  rankings: RatingRankingRow[];
};

const SCOPE_OPTIONS: Array<{ value: ScopeValue; label: string }> = [
  { value: "club", label: "내 클럽" },
  { value: "national", label: "전국 클럽" },
];

const MODE_OPTIONS: Array<{ value: RankingMode; label: string }> = [
  { value: "point", label: "포인트" },
  { value: "rating", label: "레이팅" },
];

function formatDate(value?: string | null) {
  if (!value) return "-";
  return String(value).slice(0, 10);
}

function formatStreak(streak: number) {
  if (streak > 0) return `W${streak}`;
  if (streak < 0) return `L${Math.abs(streak)}`;
  return "-";
}

export default function AdminRankingPage() {
  const token = useAppSelector((s) => s.admin.token) ?? "";

  const [clubs, setClubs] = useState<ClubOption[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedSport, setSelectedSport] = useState("");
  const [scope, setScope] = useState<ScopeValue>("club");
  const [mode, setMode] = useState<RankingMode>("point");
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined);
  const [loadingClubs, setLoadingClubs] = useState(false);
  const [loadingRanking, setLoadingRanking] = useState(false);
  const [pointRanking, setPointRanking] = useState<AdminPointRankingResponse | null>(null);
  const [ratingRanking, setRatingRanking] = useState<AdminRatingRankingResponse | null>(null);

  const fetchClubs = useCallback(async () => {
    if (!token) return;
    setLoadingClubs(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/clubs-list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        const nextClubs: ClubOption[] = Array.isArray(data.clubs) ? data.clubs : [];
        setClubs(nextClubs);
        setSelectedGroupId((prev) => prev || nextClubs[0]?.id || "");
        setSelectedSport((prev) => prev || nextClubs.find((club) => club.sport)?.sport || "");
      }
    } finally {
      setLoadingClubs(false);
    }
  }, [token]);

  useEffect(() => {
    fetchClubs();
  }, [fetchClubs]);

  const sportOptions = useMemo(
    () =>
      Array.from(
        new Set(
          clubs
            .map((club) => String(club.sport ?? "").trim())
            .filter(Boolean),
        ),
      ),
    [clubs],
  );

  const selectedClub = useMemo(
    () => clubs.find((club) => club.id === selectedGroupId) ?? null,
    [clubs, selectedGroupId],
  );

  useEffect(() => {
    if (!selectedSport && selectedClub?.sport) {
      setSelectedSport(selectedClub.sport);
    }
  }, [selectedClub, selectedSport]);

  const effectiveGroupId = useMemo(() => {
    if (scope !== "club") return "";
    return selectedGroupId;
  }, [scope, selectedGroupId]);

  const effectiveSport = useMemo(() => {
    if (scope !== "national") return "";
    return selectedSport;
  }, [scope, selectedSport]);

  const fetchPointRanking = useCallback(async () => {
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
      setPointRanking(data.ok ? data : null);
    } finally {
      setLoadingRanking(false);
    }
  }, [scope, selectedGroupId, selectedYear, token]);

  const fetchRatingRanking = useCallback(async () => {
    if (!token) return;
    if (scope === "club" && !effectiveGroupId) return;
    if (scope === "national" && !effectiveSport) return;

    setLoadingRanking(true);
    try {
      const params = new URLSearchParams({ scope });
      if (scope === "club") {
        params.set("group_id", effectiveGroupId);
      } else {
        params.set("sport", effectiveSport);
      }

      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/rankings/ratings?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setRatingRanking(data.ok ? data : null);
    } finally {
      setLoadingRanking(false);
    }
  }, [effectiveGroupId, effectiveSport, scope, token]);

  useEffect(() => {
    if (mode === "point") {
      fetchPointRanking();
    } else {
      fetchRatingRanking();
    }
  }, [fetchPointRanking, fetchRatingRanking, mode]);

  const activeYear = selectedYear ?? pointRanking?.year ?? new Date().getFullYear();
  const yearOptions = useMemo(() => {
    if (pointRanking?.available_years?.length) {
      return pointRanking.available_years;
    }
    return [activeYear];
  }, [activeYear, pointRanking?.available_years]);

  const currentSport = scope === "national" ? effectiveSport : selectedClub?.sport || "";
  const hasSelection = scope === "club" ? Boolean(effectiveGroupId) : Boolean(effectiveSport);

  return (
    <Box sx={{ p: 3 }}>
      <Typography sx={{ fontSize: 18, fontWeight: 900, mb: 2, color: "#1F2937" }}>
        랭킹 관리
      </Typography>

      <Stack spacing={2.5}>
        <Box
          sx={{
            border: "1px solid #E5E7EB",
            borderRadius: 1.5,
            px: 2.5,
            py: 2,
          }}
        >
          <Stack spacing={1.5}>
            <ToggleButtonGroup
              exclusive
              value={mode}
              onChange={(_event, nextMode: RankingMode | null) => {
                if (!nextMode) return;
                setMode(nextMode);
              }}
              sx={{
                "& .MuiToggleButton-root": {
                  fontSize: 12,
                  fontWeight: 800,
                  px: 2,
                  py: 0.8,
                },
              }}
            >
              {MODE_OPTIONS.map((option) => (
                <ToggleButton key={option.value} value={option.value}>
                  {option.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  lg: mode === "point" ? "minmax(0, 1fr) 120px 120px" : "minmax(0, 1fr) 120px",
                },
                columnGap: 1.5,
                rowGap: 1.25,
                alignItems: "end",
              }}
            >
              {scope === "club" ? (
                <FilterField label="클럽">
                  <Select
                    size="small"
                    fullWidth
                    value={selectedGroupId}
                    onChange={(event: SelectChangeEvent) => {
                      const nextGroupId = event.target.value;
                      const nextClub = clubs.find((club) => club.id === nextGroupId) ?? null;
                      setSelectedGroupId(nextGroupId);
                      if (nextClub?.sport) {
                        setSelectedSport(nextClub.sport);
                      }
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
              ) : (
                <FilterField label="종목">
                  <Select
                    size="small"
                    fullWidth
                    value={selectedSport}
                    onChange={(event: SelectChangeEvent) => {
                      setSelectedSport(event.target.value);
                      setSelectedYear(undefined);
                    }}
                    sx={{ fontSize: 12, height: 36 }}
                    disabled={sportOptions.length === 0}
                  >
                    {sportOptions.map((sport) => (
                      <MenuItem key={sport} value={sport} sx={{ fontSize: 12 }}>
                        {sport}
                      </MenuItem>
                    ))}
                  </Select>
                </FilterField>
              )}

              {mode === "point" ? (
                <FilterField label="연도">
                  <Select
                    size="small"
                    fullWidth
                    value={String(activeYear)}
                    onChange={(event: SelectChangeEvent) => setSelectedYear(Number(event.target.value))}
                    sx={{ fontSize: 12, height: 36 }}
                    disabled={!pointRanking}
                  >
                    {yearOptions.map((year) => (
                      <MenuItem key={year} value={String(year)} sx={{ fontSize: 12 }}>
                        {year}년
                      </MenuItem>
                    ))}
                  </Select>
                </FilterField>
              ) : null}

              <FilterField label="범위">
                <Select
                  size="small"
                  fullWidth
                  value={scope}
                  onChange={(event: SelectChangeEvent<ScopeValue>) => {
                    const nextScope = event.target.value as ScopeValue;
                    setScope(nextScope);
                    setSelectedYear(undefined);
                    if (nextScope === "national" && !selectedSport && selectedClub?.sport) {
                      setSelectedSport(selectedClub.sport);
                    }
                  }}
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

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip
                label={
                  scope === "club"
                    ? selectedClub
                      ? `기준 클럽 ${selectedClub.name}`
                      : "기준 클럽 미선택"
                    : currentSport
                      ? `기준 종목 ${currentSport}`
                      : "기준 종목 미선택"
                }
                size="small"
                sx={{ fontWeight: 700 }}
              />
              {currentSport ? (
                <Chip label={`종목 ${currentSport}`} size="small" sx={{ fontWeight: 700 }} />
              ) : null}
              <Chip
                label={scope === "club" ? "클럽 내부 순위" : "선택 종목 전국 순위"}
                size="small"
                sx={{ fontWeight: 700 }}
              />
              <Chip
                label={mode === "point" ? "포인트 순위" : "레이팅 순위"}
                size="small"
                sx={{ fontWeight: 700 }}
              />
            </Stack>
          </Stack>
        </Box>

        {loadingRanking ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress size={30} />
          </Box>
        ) : !hasSelection ? (
          <EmptyState message="조회할 기준 정보가 없습니다." />
        ) : mode === "point" ? (
          !pointRanking ? (
            <EmptyState message="포인트 순위 정보를 불러오지 못했습니다." />
          ) : (
            <Stack spacing={2.5}>
              <PointRankingSection title="리그" rows={pointRanking.league.rankings} />
              <PointRankingSection title="대회" rows={pointRanking.tournament.rankings} />
            </Stack>
          )
        ) : !ratingRanking ? (
          <EmptyState message="레이팅 순위 정보를 불러오지 못했습니다." />
        ) : (
          <RatingRankingSection
            title={scope === "club" ? "클럽 레이팅" : `${currentSport || "종목"} 레이팅`}
            rows={ratingRanking.rankings}
          />
        )}
      </Stack>
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

function PointRankingSection({ title, rows }: { title: string; rows: PointRankingRow[] }) {
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

function RatingRankingSection({ title, rows }: { title: string; rows: RatingRankingRow[] }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 16, fontWeight: 900, color: "#111827", mb: 1.25 }}>
        {title}
      </Typography>
      <Box sx={{ border: "1px solid #E5E7EB", borderRadius: 1.5, overflow: "hidden" }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "#F9FAFB" }}>
              {["순위", "이름", "부수", "레이팅", "경기", "승", "패", "승률", "흐름", "최근 경기일"].map((label) => (
                <TableCell key={label} sx={{ fontWeight: 800, fontSize: 12, color: "#374151", py: 1.2 }}>
                  {label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} align="center" sx={{ py: 5, color: "#9CA3AF", fontSize: 13, fontWeight: 700 }}>
                  집계된 레이팅이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={`${title}-${row.member_id}`} hover>
                  <TableCell sx={{ fontSize: 12, fontWeight: 800 }}>{row.rank ?? "-"}</TableCell>
                  <TableCell sx={{ fontSize: 12, fontWeight: 700 }}>{row.name}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{row.division ?? "-"}</TableCell>
                  <TableCell sx={{ fontSize: 12, fontWeight: 900, color: "#1D4ED8" }}>{row.rating}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{row.matches_played}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{row.wins}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{row.losses}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{row.win_rate}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{formatStreak(row.streak)}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{formatDate(row.last_match_at)}</TableCell>
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
