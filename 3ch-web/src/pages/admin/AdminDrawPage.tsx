import { useState, useEffect, useCallback } from "react";
import {
  Box, Button, Chip, CircularProgress,
  MenuItem, Pagination, Select, Stack,
  Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography, Divider,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import { useAppSelector } from "../../app/hooks";

type Draw = {
  id: string;
  name: string;
  sport: string | null;
  start_date: string | null;
  created_at: string;
  club_name: string | null;
  creator_name: string | null;
  prize_count: number;
};

type Filters = {
  code: string; sport: string; club: string; creator: string;
  league_from: string; league_to: string;
  event_from: string; event_to: string;
  from: string; to: string;
};

const EMPTY_FILTERS: Filters = {
  code: "", sport: "", club: "", creator: "",
  league_from: "", league_to: "",
  event_from: "", event_to: "",
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

const LIMIT = 20;

export default function AdminDrawPage() {
  const token = useAppSelector((s) => s.admin.token) ?? "";

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [query,   setQuery]   = useState<Filters>(EMPTY_FILTERS);
  const [draws,   setDraws]   = useState<Draw[]>([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(false);

  const fetchDraws = useCallback(async (q: Filters, p: number) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
    (Object.entries(q) as [string, string][]).forEach(([k, v]) => { if (v) params.set(k, v); });
    try {
      const res  = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/draws?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) { setDraws(data.draws); setTotal(data.total); }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchDraws(query, page); }, [query, page, fetchDraws]);

  const handleSearch = () => { setPage(1); setQuery({ ...filters }); };
  const handleReset  = () => { setFilters(EMPTY_FILTERS); setPage(1); setQuery(EMPTY_FILTERS); };

  const setDateRange = (field: "league" | "event" | "created", days: number) => {
    const to   = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    const f = from.toISOString().slice(0, 10);
    const t = to.toISOString().slice(0, 10);
    if (field === "league")  setFilters((p) => ({ ...p, league_from: f, league_to: t }));
    if (field === "event")   setFilters((p) => ({ ...p, event_from: f,  event_to: t  }));
    if (field === "created") setFilters((p) => ({ ...p, from: f,        to: t        }));
  };

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <Box sx={{ p: 3 }}>
      <Typography sx={{ fontSize: 18, fontWeight: 900, mb: 2, color: "#1F2937" }}>추첨 관리</Typography>

      {/* 검색 필터 */}
      <Box sx={{ border: "1px solid #E5E7EB", borderRadius: 1.5, px: 2.5, py: 2, mb: 2 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", rowGap: 1.2, columnGap: 3, mb: 1.5 }}>

          {/* 행 1: 추첨코드 / 종목 / 클럽 */}
          <FilterField label="추첨코드">
            <TextField size="small" fullWidth placeholder="추첨코드"
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

          {/* 행 2: 리그날짜 (span 3) */}
          <Box sx={{ gridColumn: "span 3" }}>
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

          {/* 행 3: 대회날짜 (span 3) */}
          <Box sx={{ gridColumn: "span 3" }}>
            <FilterField label="대회날짜">
              <Stack direction="row" alignItems="center" spacing={0.6}>
                <TextField size="small" placeholder="YYYY-MM-DD" value={filters.event_from}
                  inputProps={{ style: { fontSize: 12 } }}
                  onChange={(e) => setFilters((p) => ({ ...p, event_from: e.target.value }))}
                  sx={{ width: 112 }}
                />
                <Typography sx={{ fontSize: 12, color: "#6B7280", flexShrink: 0 }}>~</Typography>
                <TextField size="small" placeholder="YYYY-MM-DD" value={filters.event_to}
                  inputProps={{ style: { fontSize: 12 } }}
                  onChange={(e) => setFilters((p) => ({ ...p, event_to: e.target.value }))}
                  sx={{ width: 112 }}
                />
                <Button size="small" variant="outlined" onClick={() => setDateRange("event", 7)}
                  sx={{ minWidth: 0, px: 1, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>일주일</Button>
                <Button size="small" variant="outlined" onClick={() => setDateRange("event", 30)}
                  sx={{ minWidth: 0, px: 1, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>1개월</Button>
                <Button size="small" variant="outlined" onClick={() => setDateRange("event", 90)}
                  sx={{ minWidth: 0, px: 1, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>3개월</Button>
              </Stack>
            </FilterField>
          </Box>

          {/* 행 4: 생성자 / 생성일 (span 2) */}
          <FilterField label="생성자">
            <TextField size="small" fullWidth placeholder="이름"
              inputProps={{ style: { fontSize: 12 } }}
              value={filters.creator} onChange={(e) => setFilters((p) => ({ ...p, creator: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
            />
          </FilterField>
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
              {["추첨코드", "종목", "클럽", "리그날짜", "대회날짜", "생성자", "생성일시", "경품"].map((h) => (
                <TableCell key={h} sx={{ fontWeight: 800, fontSize: 12, color: "#374151", py: 1.2 }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            ) : draws.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 6, color: "#9CA3AF", fontWeight: 700, fontSize: 13 }}>
                  생성된 추첨이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              draws.map((d) => (
                <TableRow key={d.id} hover>
                  <TableCell sx={{ fontSize: 12 }}>{d.id.slice(0, 8)}…</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>
                    {d.sport ? (
                      <Chip label={d.sport} size="small" sx={{ height: 20, fontSize: 11, fontWeight: 700 }} />
                    ) : "-"}
                  </TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{d.club_name ?? "-"}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{d.start_date ? d.start_date.slice(0, 10) : "-"}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{d.created_at.slice(0, 10)}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{d.creator_name ?? "-"}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{d.created_at.slice(0, 16).replace("T", " ")}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{d.prize_count}개</TableCell>
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
