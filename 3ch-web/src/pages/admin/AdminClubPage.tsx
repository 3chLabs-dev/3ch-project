import { useState, useEffect, useCallback } from "react";
import {
  Box, Button, Chip, CircularProgress,
  Dialog, DialogContent, DialogTitle,
  FormControl, MenuItem, Pagination, Select, Stack,
  Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography, Divider,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import { useAppSelector } from "../../app/hooks";
import { REGION_DATA, CITY_ALIAS_MAP } from "../group/regionData";

type Club = {
  id: string;
  club_code: string | null;
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

  const [addOpen,         setAddOpen]         = useState(false);
  const [addSport,        setAddSport]        = useState("");
  const [addRegionCity,   setAddRegionCity]   = useState("");
  const [addRegionDist,   setAddRegionDist]   = useState("");
  const [addName,         setAddName]         = useState("");
  const [addNameChecked,  setAddNameChecked]  = useState<boolean | null>(null);
  const [addNameMsg,      setAddNameMsg]      = useState("");
  const [addAddress,      setAddAddress]      = useState("");
  const [addAddressDet,   setAddAddressDet]   = useState("");
  const [addDescription,  setAddDescription]  = useState("");
  const [addLeader,       setAddLeader]       = useState<{ id: number; name: string; email: string } | null>(null);
  const [leaderPickOpen,    setLeaderPickOpen]    = useState(false);
  const [leaderPickFor,     setLeaderPickFor]     = useState<"add" | "edit">("add");
  const [leaderSearchName,  setLeaderSearchName]  = useState("");
  const [leaderSearchEmail, setLeaderSearchEmail] = useState("");
  const [leaderResults,     setLeaderResults]     = useState<{ id: number; name: string; email: string }[]>([]);
  const [leaderTotal,       setLeaderTotal]       = useState(0);
  const [leaderPage,        setLeaderPage]        = useState(1);
  const [leaderSearching,   setLeaderSearching]   = useState(false);
  const LEADER_LIMIT = 10;
  const [addLoading,      setAddLoading]      = useState(false);
  const [addError,        setAddError]        = useState("");

  // 편집 다이얼로그
  const [editOpen,        setEditOpen]        = useState(false);
  const [editId,          setEditId]          = useState("");
  const [editClubCode,    setEditClubCode]    = useState("");
  const [editOrigName,    setEditOrigName]    = useState("");
  const [editSport,       setEditSport]       = useState("");
  const [editCity,        setEditCity]        = useState("");
  const [editDist,        setEditDist]        = useState("");
  const [editName,        setEditName]        = useState("");
  const [editNameChecked, setEditNameChecked] = useState<boolean | null>(null);
  const [editNameMsg,     setEditNameMsg]     = useState("");
  const [editLeader,      setEditLeader]      = useState<{ id: number; name: string; email: string } | null>(null);
  const [editAddress,     setEditAddress]     = useState("");
  const [editAddressDet,  setEditAddressDet]  = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCreatedAt,   setEditCreatedAt]   = useState("");
  const [editFetching,    setEditFetching]    = useState(false);
  const [editLoading,     setEditLoading]     = useState(false);
  const [editError,       setEditError]       = useState("");
  const [editSuccess,     setEditSuccess]     = useState(false);

  const addDistricts  = addRegionCity ? (REGION_DATA[addRegionCity] ?? []) : [];
  const editDistricts = editCity      ? (REGION_DATA[editCity]      ?? []) : [];

  type DaumPostcodeData = {
    address: string;
    roadAddress: string;
    sido: string;
    sigungu: string;
  };
  type DaumWindow = Window & { daum?: { Postcode: new (opts: { oncomplete: (d: DaumPostcodeData) => void }) => { open: () => void } } };

  const handleAddressSearch = (ctx: "add" | "edit") => {
    const openPostcode = () => {
      const w = window as DaumWindow;
      new w.daum!.Postcode({
        oncomplete: (data) => {
          const addr = data.roadAddress || data.address;
          const mappedCity = CITY_ALIAS_MAP[data.sido] ?? data.sido;
          const sigungu = data.sigungu;
          const districts: string[] = REGION_DATA[mappedCity] ?? [];
          const matchedDist = districts.find((d) => sigungu.includes(d) || d.includes(sigungu)) ?? "";

          if (ctx === "add") {
            setAddAddress(addr);
            setAddAddressDet("");
            if (mappedCity && REGION_DATA[mappedCity]) {
              setAddRegionCity(mappedCity);
              setAddRegionDist(matchedDist);
            }
          } else {
            setEditAddress(addr);
            setEditAddressDet("");
            if (mappedCity && REGION_DATA[mappedCity]) {
              setEditCity(mappedCity);
              setEditDist(matchedDist);
            }
          }
        },
      }).open();
    };
    const w = window as DaumWindow;
    if (w.daum?.Postcode) {
      openPostcode();
    } else {
      const script = document.createElement("script");
      script.src = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
      script.onload = openPostcode;
      document.head.appendChild(script);
    }
  };

  const openAdd = () => {
    setAddSport(""); setAddRegionCity(""); setAddRegionDist("");
    setAddName(""); setAddNameChecked(null); setAddNameMsg("");
    setAddAddress(""); setAddAddressDet(""); setAddDescription("");
    setAddLeader(null);
    setAddError("");
    setAddOpen(true);
  };

  const fetchLeaderResults = async (page: number, name: string, email: string) => {
    setLeaderSearching(true);
    setLeaderPage(page);
    const params = new URLSearchParams();
    if (name.trim()) params.set("name", name.trim());
    if (email.trim()) params.set("email", email.trim());
    params.set("page", String(page));
    params.set("limit", String(LEADER_LIMIT));
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/admin/members/search?${params}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await res.json();
      if (data.ok) { setLeaderResults(data.members); setLeaderTotal(data.total ?? data.members.length); }
    } finally {
      setLeaderSearching(false);
    }
  };

  const handleLeaderSearch = (page = 1) => fetchLeaderResults(page, leaderSearchName, leaderSearchEmail);

  const openLeaderPick = (ctx: "add" | "edit" = "add") => {
    setLeaderPickFor(ctx);
    setLeaderSearchName(""); setLeaderSearchEmail("");
    setLeaderResults([]); setLeaderTotal(0); setLeaderPage(1);
    setLeaderPickOpen(true);
    fetchLeaderResults(1, "", "");
  };

  const selectLeader = (m: { id: number; name: string; email: string }) => {
    if (leaderPickFor === "edit") setEditLeader(m);
    else setAddLeader(m);
    setLeaderPickOpen(false);
  };

  const openEditDialog = async (clubId: string) => {
    setEditId(clubId); setEditFetching(true); setEditOpen(true);
    setEditError(""); setEditSuccess(false);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/clubs/${clubId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.ok) { setEditError("클럽 정보를 불러올 수 없습니다."); return; }
      const c = data.club;
      setEditClubCode(c.club_code ?? "");
      setEditOrigName(c.name); setEditName(c.name);
      setEditSport(c.sport ?? ""); setEditCity(c.region_city ?? ""); setEditDist(c.region_district ?? "");
      setEditAddress(c.address ?? ""); setEditAddressDet(c.address_detail ?? "");
      setEditDescription(c.description ?? "");
      setEditCreatedAt(c.created_at ? c.created_at.slice(0, 19).replace("T", " ") : "");
      setEditNameChecked(null); setEditNameMsg("");
      setEditLeader(c.leader_id ? { id: c.leader_id, name: c.leader_name ?? "", email: c.leader_email ?? "" } : null);
    } catch { setEditError("서버 오류가 발생했습니다."); }
    finally { setEditFetching(false); }
  };

  const handleEditCheckName = async () => {
    if (!editName.trim()) return;
    if (editName.trim() === editOrigName) { setEditNameChecked(true); setEditNameMsg("현재 클럽명입니다."); return; }
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/admin/clubs/check-name?name=${encodeURIComponent(editName.trim())}&excludeId=${editId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await res.json();
      if (data.available) { setEditNameChecked(true); setEditNameMsg("사용할 수 있는 클럽명입니다."); }
      else { setEditNameChecked(false); setEditNameMsg("이미 사용 중인 클럽명입니다."); }
    } catch { setEditNameChecked(false); setEditNameMsg("중복검사 중 오류가 발생했습니다."); }
  };

  const canEdit =
    !!editSport && !!editCity && !!editDist && !!editName.trim() &&
    (editName.trim() === editOrigName || editNameChecked === true);

  const handleEdit = async () => {
    if (!canEdit) return;
    setEditLoading(true); setEditError(""); setEditSuccess(false);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/clubs/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: editName.trim(), sport: editSport,
          region_city: editCity, region_district: editDist,
          address: editAddress.trim() || undefined,
          address_detail: editAddressDet.trim() || undefined,
          description: editDescription.trim() || undefined,
          owner_id: editLeader?.id ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setEditError(data.error ?? "수정에 실패했습니다."); return; }
      setEditSuccess(true);
      setEditOrigName(editName.trim());
      fetchClubs(query, page);
    } catch { setEditError("서버 오류가 발생했습니다."); }
    finally { setEditLoading(false); }
  };

  const handleDeleteClub = async () => {
    if (!window.confirm(`"${editOrigName}" 클럽을 삭제하시겠습니까?\n관련된 모든 리그, 추첨, 회원 데이터가 함께 삭제됩니다.`)) return;
    setEditLoading(true);
    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/clubs/${editId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setEditOpen(false);
      fetchClubs(query, page);
    } catch { setEditError("삭제 중 오류가 발생했습니다."); }
    finally { setEditLoading(false); }
  };

  const handleAddNameChange = (val: string) => {
    setAddName(val);
    setAddNameChecked(null);
    setAddNameMsg("");
  };

  const handleCheckName = async () => {
    if (!addName.trim()) return;
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/admin/clubs/check-name?name=${encodeURIComponent(addName.trim())}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await res.json();
      if (data.available) {
        setAddNameChecked(true);
        setAddNameMsg("사용할 수 있는 클럽명입니다.");
      } else {
        setAddNameChecked(false);
        setAddNameMsg("이미 사용 중인 클럽명입니다.");
      }
    } catch {
      setAddNameChecked(false);
      setAddNameMsg("중복검사 중 오류가 발생했습니다.");
    }
  };

  const canAdd =
    !!addSport && !!addRegionCity && !!addRegionDist &&
    !!addName.trim() && addNameChecked === true;

  const handleAdd = async () => {
    if (!canAdd) { setAddError("필수 항목을 모두 입력해주세요."); return; }
    setAddLoading(true);
    setAddError("");
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/clubs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: addName.trim(),
          sport: addSport,
          region_city: addRegionCity,
          region_district: addRegionDist,
          address: addAddress.trim() || undefined,
          address_detail: addAddressDet.trim() || undefined,
          description: addDescription.trim() || undefined,
          owner_id: addLeader?.id ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setAddError(data.error ?? "오류가 발생했습니다."); return; }
      setAddOpen(false);
      fetchClubs(query, 1);
      setPage(1);
    } finally {
      setAddLoading(false);
    }
  };

  const fetchClubs = useCallback(async (q: Filters, p: number) => {
    if (!token) return;
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
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography sx={{ fontSize: 18, fontWeight: 900, color: "#1F2937" }}>클럽 관리</Typography>
        <Button variant="contained" disableElevation size="small" startIcon={<AddIcon />}
          onClick={openAdd} sx={{ fontWeight: 700, borderRadius: 1 }}>
          클럽 추가
        </Button>
      </Stack>

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
              {["클럽코드", "종목", "지역", "클럽명", "리더", "생성일시"].map((h) => (
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
                    <TableCell
                      onClick={() => openEditDialog(c.id)}
                      sx={{ fontSize: 12, fontFamily: "monospace", color: "#2F80ED", cursor: "pointer", fontWeight: 700, "&:hover": { textDecoration: "underline" } }}
                    >
                      {c.club_code ?? c.id.slice(0, 8) + "…"}
                    </TableCell>
                    <TableCell sx={{ fontSize: 12 }}>
                      {c.sport ? (
                        <Chip label={c.sport} size="small" sx={{ height: 20, fontSize: 11, fontWeight: 700 }} />
                      ) : "-"}
                    </TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{region}</TableCell>
                    <TableCell sx={{ fontSize: 12, fontWeight: 700 }}>{c.name}</TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{c.leader_name ?? "-"}</TableCell>
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

      {/* 클럽 추가 다이얼로그 */}
      <Dialog open={addOpen} onClose={() => !addLoading && setAddOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 900, fontSize: 15, pb: 0 }}>클럽 추가</DialogTitle>
        <Divider sx={{ mx: 3, mt: 1.5 }} />
        <DialogContent sx={{ pt: 2, px: 3 }}>
          <Stack spacing={1.8}>
            <AddFormRow label="종목" required>
              <FormControl fullWidth size="small">
                <Select displayEmpty value={addSport}
                  onChange={(e: SelectChangeEvent) => setAddSport(e.target.value)}>
                  <MenuItem value=""><em style={{ color: "#9CA3AF" }}>선택</em></MenuItem>
                  {SPORT_OPTIONS.filter((o) => o.value).map((o) => (
                    <MenuItem key={o.value} value={o.value} sx={{ fontSize: 13 }}>{o.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </AddFormRow>

            <AddFormRow label="주소">
              <Stack spacing={0.8}>
                <Stack direction="row" spacing={0.8}>
                  <TextField size="small" sx={{ flex: 1 }} placeholder="도로명 주소"
                    value={addAddress} slotProps={{ input: { readOnly: true } }} />
                  <Button variant="outlined" size="small" onClick={() => handleAddressSearch("add")}
                    sx={{ fontWeight: 700, whiteSpace: "nowrap", fontSize: 12, px: 1.5 }}>
                    검색
                  </Button>
                </Stack>
                {addAddress && (
                  <TextField size="small" fullWidth placeholder="상세 주소 (동/호수 등)"
                    value={addAddressDet} onChange={(e) => setAddAddressDet(e.target.value)}
                    inputProps={{ maxLength: 200 }} />
                )}
              </Stack>
            </AddFormRow>

            <AddFormRow label="지역" required>
              <Stack direction="row" spacing={0.8}>
                <FormControl sx={{ flex: 1 }} size="small">
                  <Select displayEmpty value={addRegionCity}
                    onChange={(e: SelectChangeEvent) => { setAddRegionCity(e.target.value); setAddRegionDist(""); }}>
                    <MenuItem value=""><em style={{ color: "#9CA3AF" }}>광역시/도</em></MenuItem>
                    {Object.keys(REGION_DATA).map((city) => (
                      <MenuItem key={city} value={city} sx={{ fontSize: 13 }}>{city}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl sx={{ flex: 1 }} size="small">
                  <Select displayEmpty value={addRegionDist} disabled={!addRegionCity}
                    onChange={(e: SelectChangeEvent) => setAddRegionDist(e.target.value)}>
                    <MenuItem value=""><em style={{ color: "#9CA3AF" }}>시/군/구</em></MenuItem>
                    {addDistricts.map((d) => (
                      <MenuItem key={d} value={d} sx={{ fontSize: 13 }}>{d}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
            </AddFormRow>

            <AddFormRow label="클럽명" required>
              <Stack spacing={0.5}>
                <Stack direction="row" spacing={0.8}>
                  <TextField size="small" placeholder="클럽명" sx={{ flex: 1 }}
                    value={addName} onChange={(e) => handleAddNameChange(e.target.value)}
                    inputProps={{ maxLength: 100 }} />
                  <Button variant="outlined" size="small" onClick={handleCheckName}
                    disabled={!addName.trim()}
                    sx={{ fontWeight: 700, whiteSpace: "nowrap", fontSize: 12, px: 1.5 }}>
                    중복검사
                  </Button>
                </Stack>
                {addNameMsg && (
                  <Typography fontSize={11} fontWeight={600} color={addNameChecked ? "#1976D2" : "#E53935"}>
                    {addNameMsg}
                  </Typography>
                )}
              </Stack>
            </AddFormRow>

            <AddFormRow label="리더">
              <TextField
                size="small" fullWidth placeholder="클릭하여 회원 검색"
                value={addLeader ? `${addLeader.name} (${addLeader.email})` : ""}
                slotProps={{ input: { readOnly: true, endAdornment: <SearchIcon sx={{ fontSize: 16, color: "#9CA3AF" }} /> } }}
                onClick={() => openLeaderPick("add")}
                sx={{ cursor: "pointer", "& .MuiOutlinedInput-root": { cursor: "pointer" } }}
              />
            </AddFormRow>

            <AddFormRow label="클럽 소개">
              <TextField
                fullWidth multiline rows={4}
                placeholder="클럽 소개 작성"
                value={addDescription}
                onChange={(e) => setAddDescription(e.target.value)}
                inputProps={{ maxLength: 1000, style: { fontSize: 13 } }}
              />
            </AddFormRow>

            {addError && (
              <Typography fontSize={12} color="error" fontWeight={600}>{addError}</Typography>
            )}
          </Stack>
        </DialogContent>
        <Divider sx={{ mx: 3 }} />
        <Box sx={{ px: 3, py: 2, display: "flex", gap: 1 }}>
          <Button fullWidth variant="outlined" onClick={() => setAddOpen(false)} disabled={addLoading}
            sx={{ fontWeight: 700, borderRadius: 1, py: 0.8, borderColor: "#D1D5DB", color: "#374151" }}>
            취소
          </Button>
          <Button fullWidth variant="contained" disableElevation onClick={handleAdd}
            disabled={addLoading || !canAdd}
            sx={{ fontWeight: 700, borderRadius: 1, py: 0.8 }}>
            {addLoading ? "생성 중..." : "클럽 생성"}
          </Button>
        </Box>
      </Dialog>

      {/* 클럽 편집 다이얼로그 */}
      <Dialog open={editOpen} onClose={() => !editLoading && setEditOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 900, fontSize: 15, pb: 0 }}>클럽 상세</DialogTitle>
        <Divider sx={{ mx: 3, mt: 1.5 }} />
        <DialogContent sx={{ pt: 2, px: 3 }}>
          {editFetching ? (
            <Box sx={{ py: 6, textAlign: "center" }}><CircularProgress size={28} /></Box>
          ) : (
            <Stack spacing={1.8}>
              {editSuccess && (
                <Box sx={{ bgcolor: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 1, px: 2, py: 1 }}>
                  <Typography fontSize={13} fontWeight={700} color="#15803D">수정 완료</Typography>
                </Box>
              )}
              {editError && <Typography fontSize={12} color="error" fontWeight={600}>{editError}</Typography>}

              <AddFormRow label="클럽코드" plain>
                <Typography sx={{ fontSize: 13, fontFamily: "monospace", fontWeight: 700, color: "#2F80ED" }}>
                  {editClubCode || "-"}
                </Typography>
              </AddFormRow>

              <AddFormRow label="종목" required>
                <FormControl fullWidth size="small">
                  <Select displayEmpty value={editSport}
                    onChange={(e: SelectChangeEvent) => setEditSport(e.target.value)}>
                    <MenuItem value=""><em style={{ color: "#9CA3AF" }}>선택</em></MenuItem>
                    {SPORT_OPTIONS.filter((o) => o.value).map((o) => (
                      <MenuItem key={o.value} value={o.value} sx={{ fontSize: 13 }}>{o.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </AddFormRow>

              <AddFormRow label="주소">
                <Stack spacing={0.8}>
                  <Stack direction="row" spacing={0.8}>
                    <TextField size="small" sx={{ flex: 1 }} placeholder="도로명 주소"
                      value={editAddress} slotProps={{ input: { readOnly: true } }} />
                    <Button variant="outlined" size="small" onClick={() => handleAddressSearch("edit")}
                      sx={{ fontWeight: 700, whiteSpace: "nowrap", fontSize: 12, px: 1.5 }}>
                      검색
                    </Button>
                  </Stack>
                  {editAddress && (
                    <TextField size="small" fullWidth placeholder="상세 주소 (동/호수 등)"
                      value={editAddressDet} onChange={(e) => setEditAddressDet(e.target.value)}
                      inputProps={{ maxLength: 200 }} />
                  )}
                </Stack>
              </AddFormRow>

              <AddFormRow label="지역" required>
                <Stack direction="row" spacing={0.8}>
                  <FormControl sx={{ flex: 1 }} size="small">
                    <Select displayEmpty value={editCity}
                      onChange={(e: SelectChangeEvent) => { setEditCity(e.target.value); setEditDist(""); }}>
                      <MenuItem value=""><em style={{ color: "#9CA3AF" }}>광역시/도</em></MenuItem>
                      {Object.keys(REGION_DATA).map((city) => (
                        <MenuItem key={city} value={city} sx={{ fontSize: 13 }}>{city}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl sx={{ flex: 1 }} size="small">
                    <Select displayEmpty value={editDist} disabled={!editCity}
                      onChange={(e: SelectChangeEvent) => setEditDist(e.target.value)}>
                      <MenuItem value=""><em style={{ color: "#9CA3AF" }}>시/군/구</em></MenuItem>
                      {editDistricts.map((d) => (
                        <MenuItem key={d} value={d} sx={{ fontSize: 13 }}>{d}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>
              </AddFormRow>

              <AddFormRow label="클럽명" required>
                <Stack spacing={0.5}>
                  <Stack direction="row" spacing={0.8}>
                    <TextField size="small" placeholder="클럽명" sx={{ flex: 1 }}
                      value={editName}
                      onChange={(e) => { setEditName(e.target.value); setEditNameChecked(null); setEditNameMsg(""); }}
                      inputProps={{ maxLength: 100 }} />
                    {editName.trim() !== editOrigName && (
                      <Button variant="outlined" size="small" onClick={handleEditCheckName}
                        disabled={!editName.trim()}
                        sx={{ fontWeight: 700, whiteSpace: "nowrap", fontSize: 12, px: 1.5 }}>
                        중복검사
                      </Button>
                    )}
                  </Stack>
                  {editNameMsg && (
                    <Typography fontSize={11} fontWeight={600} color={editNameChecked ? "#1976D2" : "#E53935"}>
                      {editNameMsg}
                    </Typography>
                  )}
                </Stack>
              </AddFormRow>

              <AddFormRow label="리더">
                <TextField
                  size="small" fullWidth
                  placeholder="클릭하여 회원 검색"
                  value={editLeader ? `${editLeader.name} (${editLeader.email})` : ""}
                  slotProps={{ input: { readOnly: true, endAdornment: <SearchIcon sx={{ fontSize: 16, color: "#9CA3AF" }} /> } }}
                  onClick={() => openLeaderPick("edit")}
                  sx={{ cursor: "pointer", "& .MuiOutlinedInput-root": { cursor: "pointer" } }}
                />
              </AddFormRow>

              <AddFormRow label="클럽 소개">
                <TextField
                  fullWidth multiline rows={4}
                  placeholder="클럽 소개 작성"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  inputProps={{ maxLength: 1000, style: { fontSize: 13 } }}
                />
              </AddFormRow>

              <AddFormRow label="생성일시" plain>
                <Typography fontSize={13} color="#6B7280">{editCreatedAt || "-"}</Typography>
              </AddFormRow>
            </Stack>
          )}
        </DialogContent>
        <Divider sx={{ mx: 3 }} />
        <Box sx={{ px: 3, py: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Button size="small" onClick={handleDeleteClub} disabled={editLoading || editFetching}
              sx={{ fontSize: 12, color: "#EF4444", fontWeight: 700, p: 0, minWidth: 0 }}>
              클럽 삭제
            </Button>
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" onClick={() => setEditOpen(false)} disabled={editLoading}
                sx={{ fontWeight: 700, borderRadius: 1, py: 0.8, px: 2.5, borderColor: "#D1D5DB", color: "#374151" }}>
                취소
              </Button>
              <Button variant="contained" disableElevation onClick={handleEdit}
                disabled={editLoading || editFetching || !canEdit}
                sx={{ fontWeight: 700, borderRadius: 1, py: 0.8, px: 2.5 }}>
                {editLoading ? "저장 중..." : "수정"}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Dialog>

      {/* 리더 선택 다이얼로그 */}
      <Dialog open={leaderPickOpen} onClose={() => setLeaderPickOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 900, fontSize: 15, pb: 0 }}>리더 검색</DialogTitle>
        <Divider sx={{ mx: 3, mt: 1.5 }} />
        <DialogContent sx={{ pt: 2, px: 3, pb: 1 }}>
          {/* 검색 입력 */}
          <Stack direction="row" spacing={0.8} mb={1}>
            <TextField
              size="small" autoFocus placeholder="이름" sx={{ flex: 1 }}
              value={leaderSearchName}
              onChange={(e) => setLeaderSearchName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleLeaderSearch(1); }}
            />
            <TextField
              size="small" placeholder="아이디(이메일)" sx={{ flex: 1.4 }}
              value={leaderSearchEmail}
              onChange={(e) => setLeaderSearchEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleLeaderSearch(1); }}
            />
            <Button
              variant="contained" disableElevation size="small"
              onClick={() => handleLeaderSearch(1)}
              disabled={leaderSearching}
              sx={{ fontWeight: 700, whiteSpace: "nowrap", px: 2 }}
            >
              {leaderSearching ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : "검색"}
            </Button>
          </Stack>

          {/* 결과 */}
          <Box sx={{ border: "1px solid #E5E7EB", borderRadius: 1, overflow: "hidden", minHeight: 200 }}>
            {leaderSearching ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                <CircularProgress size={24} />
              </Box>
            ) : leaderResults.length === 0 ? (
              <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 6 }}>
                <Typography fontSize={13} color="#9CA3AF">검색 결과가 없습니다.</Typography>
              </Box>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "#F9FAFB" }}>
                    <TableCell sx={{ fontWeight: 700, fontSize: 12, py: 1 }}>이름</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 12, py: 1 }}>아이디</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {leaderResults.map((m) => {
                    const currentLeader = leaderPickFor === "edit" ? editLeader : addLeader;
                    const isSelected = currentLeader?.id === m.id;
                    return (
                    <TableRow key={m.id} hover onClick={() => selectLeader(m)}
                      sx={{ cursor: "pointer", bgcolor: isSelected ? "#EFF6FF" : undefined }}>
                      <TableCell sx={{ fontSize: 13, fontWeight: isSelected ? 700 : 500, color: isSelected ? "#1D4ED8" : undefined }}>
                        {m.name}
                      </TableCell>
                      <TableCell sx={{ fontSize: 12, color: "#6B7280" }}>{m.email}</TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Box>

          {/* 페이지네이션 */}
          {leaderTotal > LEADER_LIMIT && (
            <Stack alignItems="center" mt={1}>
              <Pagination count={Math.ceil(leaderTotal / LEADER_LIMIT)} page={leaderPage}
                onChange={(_, v) => handleLeaderSearch(v)} size="small" shape="rounded" />
            </Stack>
          )}
        </DialogContent>
        <Divider sx={{ mx: 3 }} />
        <Box sx={{ px: 3, py: 1.5 }}>
          <Button fullWidth variant="outlined" onClick={() => setLeaderPickOpen(false)}
            sx={{ fontWeight: 700, borderRadius: 1, py: 0.8, borderColor: "#D1D5DB", color: "#374151" }}>
            닫기
          </Button>
        </Box>
      </Dialog>
    </Box>
  );
}

function AddFormRow({ label, required, plain, children }: { label: string; required?: boolean; plain?: boolean; children: React.ReactNode }) {
  return (
    <Stack direction="row" alignItems={plain ? "center" : "flex-start"} spacing={2}>
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#374151", width: 52, flexShrink: 0, pt: plain ? 0 : 0.9, whiteSpace: "nowrap" }}>
        {label}{required && <Typography component="span" color="error" fontSize={12}> *</Typography>}
      </Typography>
      <Box sx={{ flex: 1 }}>{children}</Box>
    </Stack>
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
