import { useState } from "react";
import {
  Box, Button, Divider, MenuItem, Pagination,
  Select, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";

type Filters = {
  code: string; sport: string; group: string; name: string;
  type: string; creator: string;
  event_from: string; event_to: string;
  from: string; to: string;
};

const EMPTY_FILTERS: Filters = {
  code: "", sport: "", group: "", name: "",
  type: "", creator: "",
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

const TYPE_OPTIONS = [
  { value: "", label: "선택" },
  { value: "league", label: "리그" },
  { value: "tournament", label: "토너먼트" },
  { value: "mixed", label: "혼합" },
];

export default function AdminTournamentPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const handleReset = () => setFilters(EMPTY_FILTERS);

  const setDateRange = (field: "event" | "created", days: number) => {
    const to   = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    const f = from.toISOString().slice(0, 10);
    const t = to.toISOString().slice(0, 10);
    if (field === "event")   setFilters((p) => ({ ...p, event_from: f, event_to: t }));
    if (field === "created") setFilters((p) => ({ ...p, from: f, to: t }));
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography sx={{ fontSize: 18, fontWeight: 900, mb: 2, color: "#1F2937" }}>대회 관리</Typography>

      {/* 검색 필터 */}
      <Box sx={{ border: "1px solid #E5E7EB", borderRadius: 1.5, px: 2.5, py: 2, mb: 2 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", rowGap: 1.2, columnGap: 3, mb: 1.5 }}>

          {/* 행 1: 대회코드 / 종목 / 모임 */}
          <FilterField label="대회코드">
            <TextField size="small" fullWidth placeholder="대회코드"
              inputProps={{ style: { fontSize: 12 } }}
              value={filters.code} onChange={(e) => setFilters((p) => ({ ...p, code: e.target.value }))}
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
          <FilterField label="모임">
            <TextField size="small" fullWidth placeholder="모임명"
              inputProps={{ style: { fontSize: 12 } }}
              value={filters.group} onChange={(e) => setFilters((p) => ({ ...p, group: e.target.value }))}
            />
          </FilterField>

          {/* 행 2: 대회 / 대회날짜 (span 2) */}
          <FilterField label="대회">
            <TextField size="small" fullWidth placeholder="대회명"
              inputProps={{ style: { fontSize: 12 } }}
              value={filters.name} onChange={(e) => setFilters((p) => ({ ...p, name: e.target.value }))}
            />
          </FilterField>
          <Box sx={{ gridColumn: "span 2" }}>
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

          {/* 행 3: 유형 / 생성자 */}
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
            />
          </FilterField>
          <Box /> {/* 빈 셀 */}

          {/* 행 4: 생성일 (span 3) */}
          <Box sx={{ gridColumn: "span 3" }}>
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
          <Button variant="contained" disableElevation
            sx={{ minWidth: 80, fontWeight: 700, borderRadius: 1 }}>조회</Button>
          <Button variant="outlined" onClick={handleReset}
            sx={{ minWidth: 60, fontWeight: 700, borderRadius: 1 }}>초기화</Button>
        </Stack>
      </Box>

      {/* 테이블 헤더 */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography sx={{ fontSize: 13, color: "#6B7280", fontWeight: 600 }}>
          총 <b>0</b>개
        </Typography>
        <Button variant="contained" size="small" disableElevation
          sx={{ fontWeight: 700, borderRadius: 1, bgcolor: "#2F80ED", "&:hover": { bgcolor: "#256FD1" } }}>
          신규추가
        </Button>
      </Stack>

      {/* 테이블 */}
      <Box sx={{ border: "1px solid #E5E7EB", borderRadius: 1.5, overflow: "hidden" }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "#F9FAFB" }}>
              {["대회코드", "종목", "모임", "대회", "대회날짜", "유형", "생성자", "생성일시", "참가자"].map((h) => (
                <TableCell key={h} sx={{ fontWeight: 800, fontSize: 12, color: "#374151", py: 1.2 }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell colSpan={9} align="center" sx={{ py: 6, color: "#9CA3AF", fontWeight: 700, fontSize: 13 }}>
                생성된 대회가 없습니다.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Box>

      {/* 페이지네이션 */}
      <Stack alignItems="center" mt={2}>
        <Pagination count={1} page={1} size="small" shape="rounded" />
      </Stack>
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
