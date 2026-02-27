import { useState, useEffect, useCallback } from "react";
import {
  Box, Button, Chip, CircularProgress,
  MenuItem, Pagination, Select, Stack,
  Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography, Divider,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import { useAppSelector } from "../../app/hooks";

type Club = {
  id: string;
  name: string;
  sport: string | null;
  region_city: string | null;
  region_district: string | null;
  founded_at: string | null;
  created_at: string;
  leader_id: number | null;
  leader_name: string | null;
};

type Filters = {
  code: string; sport: string; city: string; district: string;
  club: string; leader: string; from: string; to: string;
};

const EMPTY_FILTERS: Filters = {
  code: "", sport: "", city: "", district: "",
  club: "", leader: "", from: "", to: "",
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

export default function AdminClubPage() {
  const token = useAppSelector((s) => s.admin.token) ?? "";

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [query,   setQuery]   = useState<Filters>(EMPTY_FILTERS);
  const [clubs,   setClubs]   = useState<Club[]>([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(false);

  const fetchClubs = useCallback(async (q: Filters, p: number) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
    (Object.entries(q) as [string, string][]).forEach(([k, v]) => { if (v) params.set(k, v); });
    try {
      const res  = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/clubs?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) { setClubs(data.clubs); setTotal(data.total); }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchClubs(query, page); }, [query, page, fetchClubs]);

  const handleSearch = () => { setPage(1); setQuery({ ...filters }); };
  const handleReset  = () => { setFilters(EMPTY_FILTERS); setPage(1); setQuery(EMPTY_FILTERS); };

  const setDateRange = (days: number) => {
    const to   = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    setFilters((prev) => ({
      ...prev,
      from: from.toISOString().slice(0, 10),
      to:   to.toISOString().slice(0, 10),
    }));
  };

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <Box sx={{ p: 3 }}>
      <Typography sx={{ fontSize: 18, fontWeight: 900, mb: 2, color: "#1F2937" }}>클럽 관리</Typography>

      {/* 검색 필터 */}
      <Box sx={{ border: "1px solid #E5E7EB", borderRadius: 1.5, px: 2.5, py: 2, mb: 2 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", rowGap: 1.2, columnGap: 3, mb: 1.5 }}>
          <FilterField label="클럽코드">
            <TextField size="small" fullWidth placeholder="클럽코드"
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
          {/* 지역 - 2칸 차지 */}
          <Box sx={{ gridColumn: "span 1" }}>
            <FilterField label="지역">
              <Stack direction="row" spacing={0.8}>
                <TextField size="small" fullWidth placeholder="광역시/도"
                  inputProps={{ style: { fontSize: 12 } }}
                  value={filters.city} onChange={(e) => setFilters((p) => ({ ...p, city: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                />
                <TextField size="small" fullWidth placeholder="시/군/구"
                  inputProps={{ style: { fontSize: 12 } }}
                  value={filters.district} onChange={(e) => setFilters((p) => ({ ...p, district: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                />
              </Stack>
            </FilterField>
          </Box>
          <FilterField label="클럽">
            <TextField size="small" fullWidth placeholder="클럽명"
              inputProps={{ style: { fontSize: 12 } }}
              value={filters.club} onChange={(e) => setFilters((p) => ({ ...p, club: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
            />
          </FilterField>
          <FilterField label="리더">
            <TextField size="small" fullWidth placeholder="리더 이름"
              inputProps={{ style: { fontSize: 12 } }}
              value={filters.leader} onChange={(e) => setFilters((p) => ({ ...p, leader: e.target.value }))}
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
                <Button size="small" variant="outlined" onClick={() => setDateRange(7)}
                  sx={{ minWidth: 0, px: 1, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>일주일</Button>
                <Button size="small" variant="outlined" onClick={() => setDateRange(30)}
                  sx={{ minWidth: 0, px: 1, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>1개월</Button>
                <Button size="small" variant="outlined" onClick={() => setDateRange(90)}
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
              {["클럽코드", "종목", "지역", "클럽명", "리더", "창단일", "생성일시"].map((h) => (
                <TableCell key={h} sx={{ fontWeight: 800, fontSize: 12, color: "#374151", py: 1.2 }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            ) : clubs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6, color: "#9CA3AF", fontWeight: 700, fontSize: 13 }}>
                  등록된 클럽이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              clubs.map((c) => {
                const region = [c.region_city, c.region_district].filter(Boolean).join(" ") || "-";
                return (
                  <TableRow key={c.id} hover>
                    <TableCell sx={{ fontSize: 12 }}>{c.id.slice(0, 8)}…</TableCell>
                    <TableCell sx={{ fontSize: 12 }}>
                      {c.sport ? (
                        <Chip label={c.sport} size="small" sx={{ height: 20, fontSize: 11, fontWeight: 700 }} />
                      ) : "-"}
                    </TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{region}</TableCell>
                    <TableCell sx={{ fontSize: 12, fontWeight: 700 }}>{c.name}</TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{c.leader_name ?? "-"}</TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{c.founded_at ? c.founded_at.slice(0, 10) : "-"}</TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{c.created_at.slice(0, 10)}</TableCell>
                  </TableRow>
                );
              })
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
