import { useState, useEffect, useCallback } from "react";
import {
  Alert, Box, Button, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, MenuItem, Pagination, Select, Stack,
  Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import { useAppSelector } from "../../app/hooks";

type Member = {
  id: number;
  member_code: string | null;
  email: string;
  name: string | null;
  auth_provider: string;
  created_at: string;
  role: string | null;
  grade: string | null;
  club_name: string | null;
  sport: string | null;
};

type ClubOption    = { id: string; name: string; sport: string | null };
type DetailMember  = Member & { group_id: string | null };

type Filters = {
  code: string; sport: string; club: string; role: string;
  email: string; grade: string; name: string; from: string; to: string;
};

const EMPTY_FILTERS: Filters = {
  code: "", sport: "", club: "", role: "",
  email: "", grade: "", name: "", from: "", to: "",
};

const ROLE_OPTIONS = [
  { value: "",       label: "선택" },
  { value: "owner",  label: "클럽장" },
  { value: "admin",  label: "관리자" },
  { value: "member", label: "일반" },
];

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

export default function AdminMemberPage() {
  const token = useAppSelector((s) => s.admin.token) ?? "";

  const [filters,   setFilters]   = useState<Filters>(EMPTY_FILTERS);
  const [query,     setQuery]     = useState<Filters>(EMPTY_FILTERS);
  const [members,   setMembers]   = useState<Member[]>([]);
  const [total,     setTotal]     = useState(0);
  const [page,      setPage]      = useState(1);
  const [loading,   setLoading]   = useState(false);

  // 신규추가 다이얼로그
  const [addOpen,    setAddOpen]    = useState(false);
  const [addSport,   setAddSport]   = useState("");
  const [addGroupId, setAddGroupId] = useState("");
  const [addRole,    setAddRole]    = useState("");
  const [addEmail,   setAddEmail]   = useState("");
  const [addName,    setAddName]    = useState("");
  const [addGrade,   setAddGrade]   = useState("");
  const [addError,   setAddError]   = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [clubs,      setClubs]      = useState<ClubOption[]>([]);
  const [tempPw,     setTempPw]     = useState("");   // 성공 후 알럿용

  // 상세/수정 다이얼로그
  const [editOpen,    setEditOpen]    = useState(false);
  const [editMember,  setEditMember]  = useState<DetailMember | null>(null);
  const [editSport,   setEditSport]   = useState("");
  const [editGroupId, setEditGroupId] = useState("");
  const [editRole,    setEditRole]    = useState("");
  const [editName,    setEditName]    = useState("");
  const [editGrade,   setEditGrade]   = useState("");
  const [editClubs,   setEditClubs]   = useState<ClubOption[]>([]);
  const [editLoading, setEditLoading] = useState(false);
  const [editSuccess, setEditSuccess] = useState(false);
  const [editError,   setEditError]   = useState("");

  const fetchMembers = useCallback(async (q: Filters, p: number) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
    (Object.entries(q) as [string, string][]).forEach(([k, v]) => { if (v) params.set(k, v); });
    try {
      const res  = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/members?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) { setMembers(data.members); setTotal(data.total); }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchMembers(query, page); }, [query, page, fetchMembers]);

  // 클럽 목록 로드 (다이얼로그 열릴 때 + 종목 변경 시)
  const fetchClubsFor = useCallback(async (sport: string, setter: (c: ClubOption[]) => void) => {
    const qs = sport ? `?sport=${encodeURIComponent(sport)}` : "";
    try {
      const res  = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/clubs-list${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) setter(data.clubs);
    } catch { /* ignore */ }
  }, [token]);

  const openAddDialog = () => {
    setAddSport(""); setAddGroupId(""); setAddRole(""); setAddEmail("");
    setAddName(""); setAddGrade(""); setAddError(""); setTempPw("");
    setAddOpen(true);
    fetchClubsFor("", setClubs);
  };

  const handleAddSportChange = (sport: string) => {
    setAddSport(sport); setAddGroupId("");
    fetchClubsFor(sport, setClubs);
  };

  // 상세 다이얼로그 열기
  const openEditDialog = async (id: number) => {
    setEditSuccess(false); setEditError(""); setEditLoading(true); setEditOpen(true);
    try {
      const res  = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/members/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.ok) { setEditError("불러오기 실패"); return; }
      const m = data.member as DetailMember;
      setEditMember(m);
      setEditSport(m.sport ?? "");
      setEditGroupId(m.group_id ?? "");
      setEditRole(m.role ?? "");
      setEditName(m.name ?? "");
      setEditGrade(m.grade ?? "");
      fetchClubsFor(m.sport ?? "", setEditClubs);
    } catch { setEditError("서버 오류"); }
    finally { setEditLoading(false); }
  };

  const handleEditSportChange = (sport: string) => {
    setEditSport(sport); setEditGroupId("");
    fetchClubsFor(sport, setEditClubs);
  };

  const handleEditSave = async () => {
    if (!editMember) return;
    setEditError(""); setEditLoading(true);
    try {
      const res  = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/members/${editMember.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: editName, group_id: editGroupId || null, role: editRole || undefined, grade: editGrade || undefined }),
      });
      const data = await res.json();
      if (!data.ok) { setEditError("수정 실패"); return; }
      setEditSuccess(true);
      fetchMembers(query, page);
    } catch { setEditError("서버 오류"); }
    finally { setEditLoading(false); }
  };

  const handleKickClub = async () => {
    if (!editMember || !editMember.group_id) return;
    if (!window.confirm("클럽에서 강퇴하시겠습니까?")) return;
    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/members/${editMember.id}/club`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ group_id: editMember.group_id }),
      });
      setEditMember((prev) => prev ? { ...prev, group_id: null, club_name: null, sport: null, role: null, grade: null } : null);
      setEditGroupId(""); setEditSport(""); setEditRole(""); setEditGrade("");
      fetchMembers(query, page);
    } catch { /* ignore */ }
  };

  const handleDeleteAccount = async () => {
    if (!editMember) return;
    if (!window.confirm("계정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) return;
    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/members/${editMember.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setEditOpen(false);
      fetchMembers(query, page);
    } catch { /* ignore */ }
  };

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

  const handleAdd = async () => {
    if (!addEmail.trim() || !addName.trim()) {
      setAddError("아이디(이메일)와 이름은 필수입니다."); return;
    }
    setAddError(""); setAddLoading(true);
    try {
      const res  = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          email:    addEmail,
          name:     addName,
          group_id: addGroupId || undefined,
          role:     addRole    || undefined,
          grade:    addGrade   || undefined,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setAddError(data.error === "EMAIL_EXISTS" ? "이미 존재하는 이메일입니다." : "추가 실패");
        return;
      }
      setTempPw(data.tempPassword);  // 성공 → 알럿 표시
      fetchMembers(query, page);
    } catch {
      setAddError("서버 오류");
    } finally {
      setAddLoading(false);
    }
  };

  const closeAdd = () => { setAddOpen(false); setTempPw(""); };

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <Box sx={{ p: 3 }}>
      <Typography sx={{ fontSize: 18, fontWeight: 900, mb: 2, color: "#1F2937" }}>회원 관리</Typography>

      {/* 검색 필터 */}
      <Box sx={{ border: "1px solid #E5E7EB", borderRadius: 1.5, px: 2.5, py: 2, mb: 2 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", rowGap: 1.2, columnGap: 3, mb: 1.5 }}>
          <FilterField label="회원코드">
            <TextField size="small" fullWidth placeholder="회원코드"
              inputProps={{ style: { fontSize: 12 } }}
              value={filters.code} onChange={(e) => setFilters((p) => ({ ...p, code: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
            />
          </FilterField>
          <FilterField label="종목">
            <TextField size="small" fullWidth placeholder="종목"
              inputProps={{ style: { fontSize: 12 } }}
              value={filters.sport} onChange={(e) => setFilters((p) => ({ ...p, sport: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
            />
          </FilterField>
          <FilterField label="클럽">
            <TextField size="small" fullWidth placeholder="클럽명"
              inputProps={{ style: { fontSize: 12 } }}
              value={filters.club} onChange={(e) => setFilters((p) => ({ ...p, club: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
            />
          </FilterField>
          <FilterField label="역할">
            <Select size="small" fullWidth value={filters.role}
              sx={{ fontSize: 12 }}
              onChange={(e: SelectChangeEvent) => setFilters((p) => ({ ...p, role: e.target.value }))}
            >
              {ROLE_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value} sx={{ fontSize: 12 }}>{o.label}</MenuItem>)}
            </Select>
          </FilterField>
          <FilterField label="아이디">
            <TextField size="small" fullWidth placeholder="이메일 주소"
              inputProps={{ style: { fontSize: 12 } }}
              value={filters.email} onChange={(e) => setFilters((p) => ({ ...p, email: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
            />
          </FilterField>
          <FilterField label="급수">
            <TextField size="small" fullWidth placeholder="급수"
              inputProps={{ style: { fontSize: 12 } }}
              value={filters.grade} onChange={(e) => setFilters((p) => ({ ...p, grade: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
            />
          </FilterField>
          <FilterField label="이름">
            <TextField size="small" fullWidth placeholder="이름"
              inputProps={{ style: { fontSize: 12 } }}
              value={filters.name} onChange={(e) => setFilters((p) => ({ ...p, name: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
            />
          </FilterField>
          <Box sx={{ gridColumn: "span 2" }}>
            <FilterField label="가입일">
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
          총 <b>{total}</b>명
        </Typography>
        <Button variant="contained" size="small" disableElevation onClick={openAddDialog}
          sx={{ fontWeight: 700, borderRadius: 1, bgcolor: "#2F80ED", "&:hover": { bgcolor: "#256FD1" } }}>
          신규추가
        </Button>
      </Stack>

      {/* 테이블 */}
      <Box sx={{ border: "1px solid #E5E7EB", borderRadius: 1.5, overflow: "hidden" }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "#F9FAFB" }}>
              {["회원코드", "종목", "클럽", "역할", "아이디", "급수", "이름", "가입일"].map((h) => (
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
            ) : members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 6, color: "#9CA3AF", fontWeight: 700, fontSize: 13 }}>
                  가입한 회원이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              members.map((m) => (
                <TableRow key={m.id} hover>
                  <TableCell
                    onClick={() => openEditDialog(m.id)}
                    sx={{ fontSize: 12, fontFamily: "monospace", color: "#2F80ED", cursor: "pointer", fontWeight: 700, "&:hover": { textDecoration: "underline" } }}
                  >
                    {m.member_code ?? String(m.id)}
                  </TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{m.sport ?? "-"}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{m.club_name ?? "-"}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>
                    {m.role ? (
                      <Chip label={m.role === "owner" ? "클럽장" : m.role === "admin" ? "관리자" : "일반"}
                        size="small" sx={{ height: 20, fontSize: 11, fontWeight: 700 }} />
                    ) : "-"}
                  </TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{m.email}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{m.grade ?? "-"}</TableCell>
                  <TableCell sx={{ fontSize: 12, fontWeight: 700 }}>{m.name ?? "-"}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{m.created_at.slice(0, 10)}</TableCell>
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

      {/* 신규추가 다이얼로그 */}
      <Dialog open={addOpen} onClose={closeAdd} maxWidth="xs" fullWidth>
        {/* 헤더 */}
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, fontWeight: 900, fontSize: 15, pb: 1 }}>
          <Button size="small" onClick={closeAdd}
            sx={{ minWidth: 0, p: 0.3, color: "#6B7280", fontWeight: 700, fontSize: 13 }}>
            ‹
          </Button>
          회원 추가
        </DialogTitle>
        <Divider />

        <DialogContent sx={{ pt: 2 }}>
          {/* 성공 알럿 */}
          {tempPw ? (
            <Box sx={{ py: 2, textAlign: "center" }}>
              <Typography sx={{ fontSize: 13, color: "#374151", mb: 1.5, lineHeight: 1.8 }}>
                회원을 추가했습니다.<br />
                임시비밀번호는 <b style={{ color: "#2F80ED" }}>{tempPw}</b> 입니다.
              </Typography>
              <Button variant="contained" disableElevation onClick={closeAdd}
                sx={{ fontWeight: 700, px: 4, bgcolor: "#2F80ED", "&:hover": { bgcolor: "#256FD1" } }}>
                확인
              </Button>
            </Box>
          ) : (
            <Stack spacing={2} mt={0.5}>
              {addError && <Alert severity="error" sx={{ fontSize: 13 }}>{addError}</Alert>}

              {/* 종목 */}
              <FormRow label="종목">
                <Select size="small" fullWidth value={addSport} displayEmpty
                  sx={{ fontSize: 13 }}
                  onChange={(e: SelectChangeEvent) => handleAddSportChange(e.target.value)}
                >
                  {SPORT_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value} sx={{ fontSize: 13 }}>{o.label}</MenuItem>)}
                </Select>
              </FormRow>

              {/* 클럽 */}
              <FormRow label="클럽">
                <Select size="small" fullWidth value={addGroupId} displayEmpty
                  sx={{ fontSize: 13 }}
                  onChange={(e: SelectChangeEvent) => setAddGroupId(e.target.value)}
                >
                  <MenuItem value="" sx={{ fontSize: 13 }}>선택</MenuItem>
                  {clubs.map((c) => <MenuItem key={c.id} value={c.id} sx={{ fontSize: 13 }}>{c.name}</MenuItem>)}
                </Select>
              </FormRow>

              {/* 역할 */}
              <FormRow label="역할">
                <Select size="small" fullWidth value={addRole} displayEmpty
                  sx={{ fontSize: 13 }}
                  onChange={(e: SelectChangeEvent) => setAddRole(e.target.value)}
                >
                  {ROLE_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value} sx={{ fontSize: 13 }}>{o.label}</MenuItem>)}
                </Select>
              </FormRow>

              {/* 아이디 */}
              <FormRow label="아이디">
                <TextField size="small" fullWidth placeholder="이메일"
                  slotProps={{ input: { style: { fontSize: 13 } } }}
                  value={addEmail} onChange={(e) => setAddEmail(e.target.value)}
                />
              </FormRow>

              {/* 이름 */}
              <FormRow label="이름">
                <TextField size="small" fullWidth placeholder="이름"
                  slotProps={{ input: { style: { fontSize: 13 } } }}
                  value={addName} onChange={(e) => setAddName(e.target.value)}
                />
              </FormRow>

              {/* 급수 */}
              <FormRow label="급수">
                <TextField size="small" fullWidth placeholder="급수"
                  slotProps={{ input: { style: { fontSize: 13 } } }}
                  value={addGrade} onChange={(e) => setAddGrade(e.target.value)}
                />
              </FormRow>
            </Stack>
          )}
        </DialogContent>

        {!tempPw && (
          <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
            <Button fullWidth variant="outlined" onClick={closeAdd}
              sx={{ fontWeight: 700, borderRadius: 1, py: 1 }}>취소</Button>
            <Button fullWidth variant="contained" disableElevation onClick={handleAdd} disabled={addLoading}
              sx={{ fontWeight: 700, borderRadius: 1, py: 1, bgcolor: "#2F80ED", "&:hover": { bgcolor: "#256FD1" } }}>
              {addLoading ? "저장 중..." : "저장"}
            </Button>
          </DialogActions>
        )}
      </Dialog>

      {/* 회원 상세/수정 다이얼로그 */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, fontWeight: 900, fontSize: 15, pb: 1 }}>
          <Button size="small" onClick={() => setEditOpen(false)}
            sx={{ minWidth: 0, p: 0.3, color: "#6B7280", fontWeight: 700, fontSize: 13 }}>‹</Button>
          회원 상세
        </DialogTitle>
        <Divider />

        <DialogContent sx={{ pt: 2, px: 3 }}>
          {editLoading && !editMember ? (
            <Box sx={{ py: 4, textAlign: "center" }}><CircularProgress size={28} /></Box>
          ) : editError && !editMember ? (
            <Alert severity="error" sx={{ fontSize: 13 }}>{editError}</Alert>
          ) : editMember && (
            <Stack spacing={2} mt={0.5}>
              {editSuccess && (
                <Alert severity="success" sx={{ fontSize: 13 }}>수정 완료</Alert>
              )}
              {editError && (
                <Alert severity="error" sx={{ fontSize: 13 }}>{editError}</Alert>
              )}

              {/* 회원코드 */}
              <FormRow label="회원코드">
                <Typography sx={{ fontSize: 13, fontFamily: "monospace", fontWeight: 700, color: "#2F80ED" }}>
                  {editMember.member_code ?? String(editMember.id)}
                </Typography>
              </FormRow>

              {/* 종목/클럽 */}
              <FormRow label="종목/클럽">
                <Stack direction="row" spacing={0.8}>
                  <Select size="small" fullWidth value={editSport} displayEmpty sx={{ fontSize: 13 }}
                    onChange={(e: SelectChangeEvent) => handleEditSportChange(e.target.value)}
                  >
                    {SPORT_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value} sx={{ fontSize: 13 }}>{o.label}</MenuItem>)}
                  </Select>
                  <Select size="small" fullWidth value={editGroupId} displayEmpty sx={{ fontSize: 13 }}
                    onChange={(e: SelectChangeEvent) => setEditGroupId(e.target.value)}
                  >
                    <MenuItem value="" sx={{ fontSize: 13 }}>선택</MenuItem>
                    {editClubs.map((c) => <MenuItem key={c.id} value={c.id} sx={{ fontSize: 13 }}>{c.name}</MenuItem>)}
                  </Select>
                </Stack>
              </FormRow>

              {/* 역할 */}
              <FormRow label="역할">
                <Select size="small" fullWidth value={editRole} displayEmpty sx={{ fontSize: 13 }}
                  onChange={(e: SelectChangeEvent) => setEditRole(e.target.value)}
                >
                  {ROLE_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value} sx={{ fontSize: 13 }}>{o.label}</MenuItem>)}
                </Select>
              </FormRow>

              {/* 아이디 (read-only) */}
              <FormRow label="아이디">
                <Typography sx={{ fontSize: 13, color: "#374151" }}>{editMember.email}</Typography>
              </FormRow>

              {/* 이름 */}
              <FormRow label="이름">
                <TextField size="small" fullWidth slotProps={{ input: { style: { fontSize: 13 } } }}
                  value={editName} onChange={(e) => setEditName(e.target.value)} />
              </FormRow>

              {/* 급수 */}
              <FormRow label="급수">
                <TextField size="small" fullWidth slotProps={{ input: { style: { fontSize: 13 } } }}
                  value={editGrade} onChange={(e) => setEditGrade(e.target.value)} />
              </FormRow>

              {/* 가입일시 */}
              <FormRow label="가입일시">
                <Typography sx={{ fontSize: 13, color: "#6B7280" }}>
                  {editMember.created_at.slice(0, 19).replace("T", " ")}
                </Typography>
              </FormRow>

              {/* 위험 액션 */}
              <Stack direction="row" spacing={2} pt={0.5}>
                <Button size="small" disabled={!editMember.group_id} onClick={handleKickClub}
                  sx={{ fontSize: 12, color: editMember.group_id ? "#EF4444" : "#D1D5DB", p: 0, minWidth: 0, fontWeight: 700 }}>
                  클럽 강퇴
                </Button>
                <Button size="small" onClick={handleDeleteAccount}
                  sx={{ fontSize: 12, color: "#9CA3AF", p: 0, minWidth: 0, fontWeight: 700 }}>
                  계정 삭제
                </Button>
              </Stack>
            </Stack>
          )}
        </DialogContent>

        {editMember && (
          <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
            <Button fullWidth variant="outlined" onClick={() => setEditOpen(false)}
              sx={{ fontWeight: 700, borderRadius: 1, py: 1 }}>취소</Button>
            <Button fullWidth variant="contained" disableElevation onClick={handleEditSave}
              disabled={editLoading}
              sx={{ fontWeight: 700, borderRadius: 1, py: 1, bgcolor: "#2F80ED", "&:hover": { bgcolor: "#256FD1" } }}>
              {editLoading ? "저장 중..." : "수정"}
            </Button>
          </DialogActions>
        )}
      </Dialog>
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

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Stack direction="row" alignItems="center" spacing={2}>
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#374151", width: 60, flexShrink: 0, whiteSpace: "nowrap" }}>{label}</Typography>
      <Box sx={{ flex: 1 }}>{children}</Box>
    </Stack>
  );
}
