import { useState } from "react";
import {
  Box, Button, Chip, Dialog, DialogContent,
  Divider, IconButton, MenuItem, Select, Stack, Switch,
  Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import LiveHelpOutlinedIcon from "@mui/icons-material/LiveHelpOutlined";

const API = import.meta.env.VITE_API_BASE_URL ?? "/api";

type Faq = {
  id: number;
  tab: string;
  section: string;
  question: string;
  answer_preview?: string;
  answer?: string;
  display_order: number;
  is_published: boolean;
  created_at: string;
};

type FormState = { tab: string; section: string; question: string; answer: string; display_order: number; is_published: boolean };
const EMPTY_FORM: FormState = { tab: "member", section: "", question: "", answer: "", display_order: 0, is_published: true };

const TAB_OPTIONS = [
  { value: "leader", label: "리더 / 운영진" },
  { value: "member", label: "일반 회원" },
];

function useAdminToken() {
  return localStorage.getItem("admin_token") ?? "";
}

export default function AdminFaqPage() {
  const token   = useAdminToken();
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const [faqs, setFaqs]         = useState<Faq[]>([]);
  const [loaded, setLoaded]     = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId]     = useState<number | null>(null);
  const [form, setForm]         = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [alert, setAlert]       = useState("");

  const load = async () => {
    const res  = await fetch(`${API}/admin/board/faqs`, { headers });
    const data = await res.json();
    setFaqs(data.faqs ?? []);
    setLoaded(true);
  };

  if (!loaded) load();

  const openAdd = () => { setEditId(null); setForm(EMPTY_FORM); setAlert(""); setDialogOpen(true); };

  const openEdit = async (id: number) => {
    const res  = await fetch(`${API}/admin/board/faqs/${id}`, { headers });
    const data = await res.json();
    setEditId(id);
    setForm({ tab: data.tab ?? "member", section: data.section ?? "", question: data.question, answer: data.answer, display_order: data.display_order, is_published: data.is_published });
    setAlert("");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.question.trim() || !form.answer.trim()) { setAlert("질문과 답변을 입력하세요."); return; }
    setSaving(true);
    const url    = editId ? `${API}/admin/board/faqs/${editId}` : `${API}/admin/board/faqs`;
    const method = editId ? "PUT" : "POST";
    const res    = await fetch(url, { method, headers, body: JSON.stringify(form) });
    setSaving(false);
    if (!res.ok) { setAlert((await res.json()).message ?? "오류"); return; }
    setDialogOpen(false);
    load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("삭제하시겠습니까?")) return;
    await fetch(`${API}/admin/board/faqs/${id}`, { method: "DELETE", headers });
    load();
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography sx={{ fontSize: 18, fontWeight: 900, mb: 2, color: "#1F2937" }}>FAQ</Typography>

      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography sx={{ fontSize: 13, color: "#6B7280", fontWeight: 600 }}>
          총 <b>{faqs.length}</b>개
        </Typography>
        <Button variant="contained" size="small" disableElevation onClick={openAdd}
          sx={{ fontWeight: 700, borderRadius: 1, bgcolor: "#2F80ED", "&:hover": { bgcolor: "#256FD1" } }}>
          신규추가
        </Button>
      </Stack>

      <Box sx={{ border: "1px solid #E5E7EB", borderRadius: 1.5, overflow: "hidden" }}>
        <Table size="small" sx={{ tableLayout: "fixed", width: "100%" }}>
          <colgroup>
            <col style={{ width: 52 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "22%" }} />
            <col />
            <col style={{ width: 90 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 110 }} />
          </colgroup>
          <TableHead>
            <TableRow sx={{ bgcolor: "#F9FAFB" }}>
              {(["순서", "탭", "섹션", "질문", "답변 미리보기", "공개", "등록일시", "관리"] as const).map((h) => (
                <TableCell key={h} align={h === "공개" || h === "관리" ? "center" : "left"}
                  sx={{ fontWeight: 800, fontSize: 12, color: "#374151", py: 1.2, whiteSpace: "nowrap" }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {faqs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 6, color: "#9CA3AF", fontSize: 13 }}>
                  등록된 FAQ가 없습니다.
                </TableCell>
              </TableRow>
            ) : faqs.map((f) => (
              <TableRow key={f.id} hover>
                <TableCell sx={{ fontSize: 12, color: "#6B7280" }}>{f.display_order}</TableCell>
                <TableCell>
                  <Chip label={f.tab === "leader" ? "리더/운영진" : "일반회원"} size="small"
                    sx={{ fontSize: 11, fontWeight: 700,
                      bgcolor: f.tab === "leader" ? "#EFF6FF" : "#F0FDF4",
                      color:   f.tab === "leader" ? "#1D6FBF" : "#065F46" }} />
                </TableCell>
                <TableCell>
                  <Typography sx={{ fontSize: 12, color: "#6B7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {f.section || "-"}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {f.question}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography sx={{ fontSize: 12, color: "#6B7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {f.answer_preview}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Chip label={f.is_published ? "공개" : "비공개"} size="small"
                    sx={{ fontSize: 11, fontWeight: 700,
                      bgcolor: f.is_published ? "#D1FAE5" : "#F3F4F6",
                      color:   f.is_published ? "#065F46" : "#6B7280" }} />
                </TableCell>
                <TableCell sx={{ fontSize: 12, color: "#6B7280", whiteSpace: "nowrap" }}>{f.created_at?.slice(0, 10)}</TableCell>
                <TableCell align="center" sx={{ whiteSpace: "nowrap" }}>
                  <Stack direction="row" spacing={0.5} justifyContent="center">
                    <Button size="small" onClick={() => openEdit(f.id)}
                      sx={{ fontSize: 11, fontWeight: 700, minWidth: 0, px: 1 }}>수정</Button>
                    <Button size="small" color="error" onClick={() => handleDelete(f.id)}
                      sx={{ fontSize: 11, fontWeight: 700, minWidth: 0, px: 1 }}>삭제</Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>

      {/* 추가/수정 다이얼로그 */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="md">
        {/* 헤더 */}
        <Box sx={{ px: 3, pt: 3, pb: 2.5, borderBottom: "1px solid #E5E7EB" }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box sx={{
              width: 36, height: 36, borderRadius: 1.5, flexShrink: 0,
              bgcolor: "#F0FDF4", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <LiveHelpOutlinedIcon sx={{ fontSize: 20, color: "#059669" }} />
            </Box>
            <Box flex={1}>
              <Typography fontWeight={900} fontSize={16} color="#1F2937">
                {editId ? "FAQ 수정" : "FAQ 추가"}
              </Typography>
              <Typography fontSize={12} color="#9CA3AF" fontWeight={500} sx={{ mt: 0.2 }}>
                {editId ? "등록된 FAQ를 수정합니다." : "새로운 자주 하는 질문을 작성합니다."}
              </Typography>
            </Box>
            <IconButton size="small" onClick={() => setDialogOpen(false)} sx={{ color: "#6B7280" }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Box>

        <DialogContent sx={{ px: 3, py: 3 }}>
          <Stack spacing={3}>
            {alert && (
              <Box sx={{ bgcolor: "#FEF2F2", borderRadius: 1, px: 2, py: 1.2, border: "1px solid #FECACA" }}>
                <Typography fontSize={13} color="#DC2626" fontWeight={600}>{alert}</Typography>
              </Box>
            )}

            {/* 탭 + 섹션 */}
            <Stack direction="row" spacing={2}>
              <Box sx={{ width: 160 }}>
                <Typography fontSize={12} fontWeight={700} color="#374151" sx={{ mb: 0.8 }}>
                  탭 <Typography component="span" color="error" fontSize={12}>*</Typography>
                </Typography>
                <Select
                  size="small" fullWidth
                  value={form.tab}
                  onChange={(e) => setForm((p) => ({ ...p, tab: e.target.value }))}
                >
                  {TAB_OPTIONS.map((o) => (
                    <MenuItem key={o.value} value={o.value} sx={{ fontSize: 13 }}>{o.label}</MenuItem>
                  ))}
                </Select>
              </Box>
              <Box flex={1}>
                <Typography fontSize={12} fontWeight={700} color="#374151" sx={{ mb: 0.8 }}>섹션</Typography>
                <TextField
                  size="small" fullWidth
                  placeholder="예: 클럽 만들기 & 멤버 관리"
                  value={form.section}
                  onChange={(e) => setForm((p) => ({ ...p, section: e.target.value }))}
                />
              </Box>
            </Stack>

            {/* 질문 */}
            <Box>
              <Typography fontSize={12} fontWeight={700} color="#374151" sx={{ mb: 0.8 }}>
                질문 <Typography component="span" color="error" fontSize={12}>*</Typography>
              </Typography>
              <TextField
                size="small" fullWidth
                placeholder="자주 하는 질문을 입력하세요."
                value={form.question}
                onChange={(e) => setForm((p) => ({ ...p, question: e.target.value }))}
              />
            </Box>

            {/* 답변 */}
            <Box>
              <Typography fontSize={12} fontWeight={700} color="#374151" sx={{ mb: 0.8 }}>
                답변 <Typography component="span" color="error" fontSize={12}>*</Typography>
              </Typography>
              <TextField
                size="small" fullWidth multiline rows={8}
                placeholder="답변 내용을 입력하세요."
                value={form.answer}
                onChange={(e) => setForm((p) => ({ ...p, answer: e.target.value }))}
                slotProps={{ input: { style: { fontSize: 13, fontFamily: "inherit", lineHeight: 1.8 } } }}
              />
            </Box>

            {/* 노출순서 + 공개 */}
            <Box sx={{ bgcolor: "#F9FAFB", borderRadius: 1.5, px: 2.5, py: 2, border: "1px solid #E5E7EB" }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Box>
                    <Typography fontSize={12} fontWeight={700} color="#374151" sx={{ mb: 0.6 }}>노출 순서</Typography>
                    <TextField
                      size="small" type="number" sx={{ width: 100 }}
                      value={form.display_order}
                      onChange={(e) => setForm((p) => ({ ...p, display_order: Number(e.target.value) }))}
                    />
                  </Box>
                  <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
                  <Box>
                    <Typography fontSize={13} fontWeight={700} color="#374151">공개 여부</Typography>
                    <Typography fontSize={12} color="#9CA3AF" sx={{ mt: 0.3 }}>
                      비공개 시 사용자에게 노출되지 않습니다.
                    </Typography>
                  </Box>
                </Stack>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Switch
                    checked={form.is_published}
                    onChange={(e) => setForm((p) => ({ ...p, is_published: e.target.checked }))}
                  />
                  <Chip
                    label={form.is_published ? "공개" : "비공개"}
                    size="small"
                    sx={{
                      fontSize: 11, fontWeight: 700, minWidth: 52,
                      bgcolor: form.is_published ? "#D1FAE5" : "#F3F4F6",
                      color:   form.is_published ? "#065F46" : "#6B7280",
                    }}
                  />
                </Stack>
              </Stack>
            </Box>
          </Stack>
        </DialogContent>

        <Box sx={{ px: 3, py: 2, borderTop: "1px solid #E5E7EB", bgcolor: "#F9FAFB" }}>
          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button
              variant="outlined" onClick={() => setDialogOpen(false)}
              sx={{ fontWeight: 700, borderColor: "#D1D5DB", color: "#374151", "&:hover": { borderColor: "#9CA3AF", bgcolor: "#F3F4F6" } }}
            >
              취소
            </Button>
            <Button
              variant="contained" disableElevation disabled={saving} onClick={handleSave}
              sx={{ fontWeight: 700, px: 3, bgcolor: "#2F80ED", "&:hover": { bgcolor: "#256FD1" } }}
            >
              {saving ? "저장 중..." : editId ? "수정 완료" : "등록"}
            </Button>
          </Stack>
        </Box>
      </Dialog>
    </Box>
  );
}
