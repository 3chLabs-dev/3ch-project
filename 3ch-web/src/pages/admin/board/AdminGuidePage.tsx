import { useState } from "react";
import {
  Box, Button, Dialog, DialogContent, IconButton,
  MenuItem, Pagination, Select, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PolicyEditor from "../../../components/PolicyEditor";
import axios from "axios";

const API = import.meta.env.VITE_API_BASE_URL ?? "/api";

const TABS = [
  { value: "leader", label: "리더·운영진" },
  { value: "member", label: "일반 회원" },
] as const;
type TabValue = typeof TABS[number]["value"];

const SECTIONS: Record<TabValue, string[]> = {
  leader: ["클럽 생성", "회원 관리", "리그 생성", "리그 진행", "추첨 생성", "추첨 진행"],
  member: ["클럽 가입", "리그 참가", "결과 입력", "추첨 확인"],
};

type Guide = {
  id: number;
  tab: TabValue;
  section: string;
  content_preview?: string;
  display_order: number;
  created_at: string;
};

type FormState = { tab: TabValue; section: string; content: string; display_order: number };
const EMPTY_FORM: FormState = { tab: "leader", section: "클럽 생성", content: "", display_order: 0 };

function authHeaders() {
  const token = localStorage.getItem("admin_token") ?? "";
  return { Authorization: `Bearer ${token}` };
}

export default function AdminGuidePage() {

  const [guides, setGuides]     = useState<Guide[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [loaded, setLoaded]     = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId]     = useState<number | null>(null);
  const [form, setForm]         = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [alert, setAlert]       = useState("");

  const LIMIT = 15;

  const load = async (p = page) => {
    try {
      const { data } = await axios.get(`${API}/admin/board/guide?page=${p}&limit=${LIMIT}`, { headers: authHeaders() });
      setGuides(data.guides ?? []);
      setTotal(data.total ?? 0);
    } catch {
      // 네트워크 오류 무시
    } finally {
      setLoaded(true);
    }
  };

  if (!loaded) load(1);

  const openAdd = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setAlert("");
    setDialogOpen(true);
  };

  const openEdit = async (id: number) => {
    const { data } = await axios.get(`${API}/admin/board/guide/${id}`, { headers: authHeaders() });
    setEditId(id);
    setForm({ tab: data.tab, section: data.section, content: data.content, display_order: data.display_order ?? 0 });
    setAlert("");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.content.trim()) { setAlert("내용을 입력하세요."); return; }
    setSaving(true);
    try {
      if (editId) await axios.put(`${API}/admin/board/guide/${editId}`, form, { headers: authHeaders() });
      else        await axios.post(`${API}/admin/board/guide`, form, { headers: authHeaders() });
      setDialogOpen(false);
      load(editId ? page : 1);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setAlert(msg ?? "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("삭제하시겠습니까?")) return;
    await axios.delete(`${API}/admin/board/guide/${id}`, { headers: authHeaders() });
    load(page);
  };

  const handleTabChange = (tab: TabValue) => {
    setForm((f) => ({ ...f, tab, section: SECTIONS[tab][0] }));
  };

  const fmtDate = (s: string) => s?.slice(0, 10) ?? "";

  return (
    <Box sx={{ p: 3 }}>
      <Typography sx={{ fontSize: 18, fontWeight: 900, mb: 2, color: "#1F2937" }}>이용방법</Typography>

      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography sx={{ fontSize: 13, color: "#6B7280", fontWeight: 600 }}>
          총 <b>{total}</b>개
        </Typography>
        <Button variant="contained" size="small" disableElevation onClick={openAdd}
          sx={{ fontWeight: 700, borderRadius: 1, bgcolor: "#2F80ED", "&:hover": { bgcolor: "#256FD1" } }}>
          신규추가
        </Button>
      </Stack>

      {/* 목록 테이블 */}
      <Box sx={{ border: "1px solid #E5E7EB", borderRadius: 1.5, overflow: "hidden" }}>
        <Table size="small" sx={{ tableLayout: "fixed", width: "100%" }}>
          <TableHead>
            <TableRow sx={{ bgcolor: "#F9FAFB" }}>
              {["순서", "탭", "섹션", "내용 미리보기", "등록일시", "관리"].map((h) => (
                <TableCell key={h} sx={{ fontWeight: 800, fontSize: 12, color: "#374151", py: 1.2, whiteSpace: "nowrap" }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {guides.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6, color: "#9CA3AF", fontSize: 13 }}>
                  등록된 이용방법이 없습니다.
                </TableCell>
              </TableRow>
            ) : guides.map((g, i) => (
              <TableRow key={g.id} hover>
                <TableCell sx={{ fontSize: 12, color: "#6B7280" }}>{(page - 1) * LIMIT + i + 1}</TableCell>
                <TableCell>
                  <Box component="span" sx={{
                    display: "inline-block", px: 1, py: 0.3, borderRadius: 1,
                    fontSize: 11, fontWeight: 700,
                    ...(g.tab === "leader"
                      ? { bgcolor: "#EFF6FF", color: "#1D4ED8" }
                      : { bgcolor: "#F0FDF4", color: "#15803D" }),
                  }}>
                    {TABS.find((t) => t.value === g.tab)?.label ?? g.tab}
                  </Box>
                </TableCell>
                <TableCell sx={{ fontSize: 12, fontWeight: 600 }}>{g.section}</TableCell>
                <TableCell sx={{ fontSize: 12, color: "#6B7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {g.content_preview}
                </TableCell>
                <TableCell sx={{ fontSize: 12, color: "#6B7280", whiteSpace: "nowrap" }}>{fmtDate(g.created_at)}</TableCell>
                <TableCell align="center" sx={{ whiteSpace: "nowrap" }}>
                  <Stack direction="row" spacing={1} justifyContent="center">
                    <Typography onClick={() => openEdit(g.id)}
                      sx={{ fontSize: 12, color: "#2F80ED", cursor: "pointer", fontWeight: 700 }}>수정</Typography>
                    <Typography onClick={() => handleDelete(g.id)}
                      sx={{ fontSize: 12, color: "#EF4444", cursor: "pointer", fontWeight: 700 }}>삭제</Typography>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>

      {/* 페이지네이션 */}
      {total > LIMIT && (
        <Stack alignItems="center" sx={{ mt: 3 }}>
          <Pagination count={Math.ceil(total / LIMIT)} page={page} onChange={(_, v) => { setPage(v); load(v); }} />
        </Stack>
      )}

      {/* 추가/수정 다이얼로그 */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogContent sx={{ p: 3 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Typography fontWeight={900} fontSize={16}>{editId ? "이용방법 수정" : "이용방법 추가"}</Typography>
            <IconButton size="small" onClick={() => setDialogOpen(false)}><CloseIcon /></IconButton>
          </Stack>

          <Stack spacing={2}>
            {/* 탭 선택 */}
            <Stack direction="row" alignItems="center" spacing={2}>
              <Typography fontWeight={700} fontSize={14} sx={{ width: 60, flexShrink: 0 }}>탭</Typography>
              <Select size="small" value={form.tab} onChange={(e) => handleTabChange(e.target.value as TabValue)} sx={{ minWidth: 160 }}>
                {TABS.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
              </Select>
            </Stack>

            {/* 섹션 선택 */}
            <Stack direction="row" alignItems="center" spacing={2}>
              <Typography fontWeight={700} fontSize={14} sx={{ width: 60, flexShrink: 0 }}>섹션</Typography>
              <Select size="small" value={form.section} onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))} sx={{ minWidth: 200 }}>
                {SECTIONS[form.tab].map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </Stack>

            {/* 순서 */}
            <Stack direction="row" alignItems="center" spacing={2}>
              <Typography fontWeight={700} fontSize={14} sx={{ width: 60, flexShrink: 0 }}>순서</Typography>
              <Select size="small" value={form.display_order} onChange={(e) => setForm((f) => ({ ...f, display_order: Number(e.target.value) }))} sx={{ minWidth: 100 }}>
                {[0,1,2,3,4,5,6,7,8,9].map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
              </Select>
            </Stack>

            {/* 내용 에디터 */}
            <Stack spacing={0.5}>
              <Typography fontWeight={700} fontSize={14}>내용 (이미지 업로드)</Typography>
              <PolicyEditor
                value={form.content}
                onChange={(v) => setForm((f) => ({ ...f, content: v }))}
              />
            </Stack>

            {alert && <Typography color="error" fontSize={13}>{alert}</Typography>}

            {/* 버튼 */}
            <Stack direction="row" spacing={1.5} justifyContent="flex-end">
              <Button variant="outlined" onClick={() => setDialogOpen(false)}
                sx={{ fontWeight: 700, borderRadius: 1.5 }}>취소</Button>
              <Button variant="contained" disableElevation onClick={handleSave} disabled={saving}
                sx={{ fontWeight: 700, borderRadius: 1.5, bgcolor: "#2F80ED", "&:hover": { bgcolor: "#256FD1" } }}>
                {saving ? "저장 중..." : "등록"}
              </Button>
            </Stack>
          </Stack>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
