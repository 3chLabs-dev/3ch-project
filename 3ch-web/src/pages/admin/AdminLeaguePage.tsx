import { useState, useEffect, useCallback } from "react";
import {
  Box, Button, Chip, CircularProgress,
  MenuItem, Pagination, Select, Stack,
  Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography, Divider,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import { useAppSelector } from "../../app/hooks";

type League = {
  id: string;
  name: string;
  sport: string | null;
  type: string | null;
  format: string | null;
  start_date: string | null;
  created_at: string;
  participant_count: number;
  creator_name: string | null;
  club_name: string | null;
};

type Filters = {
  code: string; sport: string; club: string; type: string;
  creator: string; league_from: string; league_to: string;
  from: string; to: string;
};

const EMPTY_FILTERS: Filters = {
  code: "", sport: "", club: "", type: "",
  creator: "", league_from: "", league_to: "",
  from: "", to: "",
};

const SPORT_OPTIONS = [
  { value: "", label: "선택" },
  { value: "배드민턴", label: "배드민턴" },
  { value: "테니스", label: "테니스" },
  { value: "탁구", label: "탁구" },
  { value: "볼링", label: "볼링" },
  { value: "골프", label: "골프" },
  { value: "축구", label: "축구" },
  { value: "농구", label: "농구" },
  { value: "기타", label: "기타" },
];

const TYPE_OPTIONS = [
  { value: "", label: "선택" },
  { value: "league", label: "리그" },
  { value: "tournament", label: "토너먼트" },
  { value: "mixed", label: "혼합" },
];

const LIMIT = 20;

const TYPE_LABEL: Record<string, string> = {
  league: "리그", tournament: "토너먼트", mixed: "혼합",
};

const FORMAT_LABEL: Record<string, string> = {
  single: "단식", double: "복식", mixed: "혼합복식",
};

export default function AdminLeaguePage() {
  const token = useAppSelector((s) => s.admin.token) ?? "";

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [query,   setQuery]   = useState<Filters>(EMPTY_FILTERS);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(false);

  const fetchLeagues = useCallback(async (q: Filters, p: number) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
    (Object.entries(q) as [string, string][]).forEach(([k, v]) => { if (v) params.set(k, v); });
    try {
      const res  = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/leagues?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) { setLeagues(data.leagues); setTotal(data.total); }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchLeagues(query, page); }, [query, page, fetchLeagues]);

  const handleSearch = () => { setPage(1); setQuery({ ...filters }); };
  const handleReset  = () => { setFilters(EMPTY_FILTERS); setPage(1); setQuery(EMPTY_FILTERS); };

  const setDateRange = (field: "league" | "created", days: number) => {
    const to   = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    if (field === "league") {
      setFilters((prev) => ({
        ...prev,
        league_from: from.toISOString().slice(0, 10),
        league_to:   to.toISOString().slice(0, 10),
      }));
    } else {
      setFilters((prev) => ({
        ...prev,
        from: from.toISOString().slice(0, 10),
        to:   to.toISOString().slice(0, 10),
      }));
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <Box sx={{ p: 3 }}>
      <Typography sx={{ fontSize: 18, fontWeight: 900, mb: 2, color: "#1F2937" }}>리그 관리</Typography>

      {/* 검색 필터 */}
      <Box sx={{ border: "1px solid #E5E7EB", borderRadius: 1.5, px: 2.5, py: 2, mb: 2 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", rowGap: 1.2, columnGap: 3, mb: 1.5 }}>
          <FilterField label="리그코드">
            <TextField size="small" fullWidth placeholder="리그코드"
              inputProps={{ style: { fontSize: 12 } }}
              value={filters.code} onChange={(e) => setFilters((p) => ({ ...p, code: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
            />
          </FilterField>
          <FilterField label="종목">
            <Select size="small" fullWidth value={filters.sport}
              sx={{ fontSize: 12 }}
              onChange={(e: SelectChangeEvent) => setFilters((p) => ({ ...p, sport: e.target.value }))}
            >
              {SPORT_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value} sx={{ fontSize: 12 }}>{o.label}</MenuItem>)}
            </Select>
          </FilterField>
          <FilterField label="클럽">
            <TextField size="small" fullWidth placeholder="클럽명"
              inputProps={{ style: { fontSize: 12 } }}
              value={filters.club} onChange={(e) => setFilters((p) => ({ ...p, club: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
            />
          </FilterField>
          {/* 리그날짜 - 2칸 차지 */}
          <Box sx={{ gridColumn: "span 2" }}>
            <FilterField label="리그날짜">
              <Stack direction="row" alignItems="center" spacing={0.6}>
                <TextField size="small" placeholder="YYYY-MM-DD" value={filters.league_from}
                  inputProps={{ style: { fontSize: 12 } }}
                  onChange={(e) => setFilters((p) => ({ ...p, league_from: e.target.value }))}
                  sx={{ width: 112 }}
                />
                <Typography sx={{ fontSize: 12, color: "#6B7280", flexShrink: 0 }}>~</Typography>
                <TextField size="small" placeholder="YYYY-MM-DD" value={filters.league_to}
                  inputProps={{ style: { fontSize: 12 } }}
                  onChange={(e) => setFilters((p) => ({ ...p, league_to: e.target.value }))}
                  sx={{ width: 112 }}
                />
                <Button size="small" variant="outlined" onClick={() => setDateRange("league", 7)}
                  sx={{ minWidth: 0, px: 1, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>일주일</Button>
                <Button size="small" variant="outlined" onClick={() => setDateRange("league", 30)}
                  sx={{ minWidth: 0, px: 1, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>1개월</Button>
                <Button size="small" variant="outlined" onClick={() => setDateRange("league", 90)}
                  sx={{ minWidth: 0, px: 1, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>3개월</Button>
              </Stack>
            </FilterField>
          </Box>
          <FilterField label="유형">
            <Select size="small" fullWidth value={filters.type}
              sx={{ fontSize: 12 }}
              onChange={(e: SelectChangeEvent) => setFilters((p) => ({ ...p, type: e.target.value }))}
            >
              {TYPE_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value} sx={{ fontSize: 12 }}>{o.label}</MenuItem>)}
            </Select>
          </FilterField>
          <FilterField label="생성자">
            <TextField size="small" fullWidth placeholder="이름"
              inputProps={{ style: { fontSize: 12 } }}
              value={filters.creator} onChange={(e) => setFilters((p) => ({ ...p, creator: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
            />
          </FilterField>
          {/* 생성일 - 2칸 차지 */}
          <Box sx={{ gridColumn: "span 2" }}>
            <FilterField label="생성일">
              <Stack direction="row" alignItems="center" spacing={0.6}>
                <TextField size="small" placeholder="YYYY-MM-DD" value={filters.from}
                  inputProps={{ style: { fontSize: 12 } }}
                  onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value }))}
                  sx={{ width: 112 }}
                />
                <Typography sx={{ fontSize: 12, color: "#6B7280", flexShrink: 0 }}>~</Typography>
                <TextField size="small" placeholder="YYYY-MM-DD" value={filters.to}
                  inputProps={{ style: { fontSize: 12 } }}
                  onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value }))}
                  sx={{ width: 112 }}
                />
                <Button size="small" variant="outlined" onClick={() => setDateRange("created", 7)}
                  sx={{ minWidth: 0, px: 1, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>일주일</Button>
                <Button size="small" variant="outlined" onClick={() => setDateRange("created", 30)}
                  sx={{ minWidth: 0, px: 1, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>1개월</Button>
                <Button size="small" variant="outlined" onClick={() => setDateRange("created", 90)}
                  sx={{ minWidth: 0, px: 1, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>3개월</Button>
              </Stack>
            </FilterField>
          </Box>
        </Box>
        <Divider sx={{ mb: 1.5 }} />
        <Stack direction="row" justifyContent="center" spacing={1}>
          <Button variant="contained" disableElevation onClick={handleSearch}
            sx={{ minWidth: 80, fontWeight: 700, borderRadius: 1 }}>조회</Button>
          <Button variant="outlined" onClick={handleReset}
            sx={{ minWidth: 60, fontWeight: 700, borderRadius: 1 }}>초기화</Button>
        </Stack>
      </Box>

      {/* 테이블 헤더 */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography sx={{ fontSize: 13, color: "#6B7280", fontWeight: 600 }}>
          총 <b>{total}</b>개
        </Typography>
      </Stack>

      {/* 테이블 */}
      <Box sx={{ border: "1px solid #E5E7EB", borderRadius: 1.5, overflow: "hidden" }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "#F9FAFB" }}>
              {["리그코드", "종목", "클럽", "리그날짜", "유형", "방식", "생성자", "생성일시", "참가자"].map((h) => (
                <TableCell key={h} sx={{ fontWeight: 800, fontSize: 12, color: "#374151", py: 1.2 }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            ) : leagues.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 6, color: "#9CA3AF", fontWeight: 700, fontSize: 13 }}>
                  생성된 리그가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              leagues.map((l) => (
                <TableRow key={l.id} hover>
                  <TableCell sx={{ fontSize: 12 }}>{l.id.slice(0, 8)}…</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>
                    {l.sport ? (
                      <Chip label={l.sport} size="small" sx={{ height: 20, fontSize: 11, fontWeight: 700 }} />
                    ) : "-"}
                  </TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{l.club_name ?? "-"}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{l.start_date ? l.start_date.slice(0, 10) : "-"}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{l.type ? (TYPE_LABEL[l.type] ?? l.type) : "-"}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{l.format ? (FORMAT_LABEL[l.format] ?? l.format) : "-"}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{l.creator_name ?? "-"}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{l.created_at.slice(0, 10)}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{l.participant_count ?? 0}명</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Box>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <Stack alignItems="center" mt={2}>
          <Pagination count={totalPages} page={page} onChange={(_, v) => setPage(v)}
            size="small" shape="rounded" />
        </Stack>
      )}
    </Box>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#374151", width: 52, flexShrink: 0, whiteSpace: "nowrap" }}>{label}</Typography>
      <Box sx={{ flex: 1 }}>{children}</Box>
    </Stack>
  );
}
