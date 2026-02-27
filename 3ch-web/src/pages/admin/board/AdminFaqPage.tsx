import { useState } from "react";
import {
  Box, Button, Chip, Dialog, DialogContent, DialogTitle,
  Divider, IconButton, Stack, Switch,
  Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

const API = import.meta.env.VITE_API_BASE_URL ?? "/api";

type Faq = {
  id: number;
  question: string;
  answer_preview?: string;
  answer?: string;
  display_order: number;
  is_published: boolean;
  created_at: string;
};

type FormState = { question: string; answer: string; display_order: number; is_published: boolean };
const EMPTY_FORM: FormState = { question: "", answer: "", display_order: 0, is_published: true };

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
    setForm({ question: data.question, answer: data.answer, display_order: data.display_order, is_published: data.is_published });
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
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "#F9FAFB" }}>
              {["순서", "질문", "답변 미리보기", "공개", "등록일시", "관리"].map((h) => (
                <TableCell key={h} sx={{ fontWeight: 800, fontSize: 12, color: "#374151", py: 1.2 }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {faqs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6, color: "#9CA3AF", fontSize: 13 }}>
                  등록된 FAQ가 없습니다.
                </TableCell>
              </TableRow>
            ) : faqs.map((f) => (
              <TableRow key={f.id} hover>
                <TableCell sx={{ fontSize: 12, color: "#6B7280", width: 48 }}>{f.display_order}</TableCell>
                <TableCell sx={{ fontSize: 12, fontWeight: 700, maxWidth: 200 }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>
                    {f.question}
                  </Typography>
                </TableCell>
                <TableCell sx={{ fontSize: 12, color: "#6B7280", maxWidth: 240 }}>
                  <Typography sx={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 240 }}>
                    {f.answer_preview}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip label={f.is_published ? "공개" : "비공개"} size="small"
                    sx={{ fontSize: 11, fontWeight: 700,
                      bgcolor: f.is_published ? "#D1FAE5" : "#F3F4F6",
                      color:   f.is_published ? "#065F46" : "#6B7280" }} />
                </TableCell>
                <TableCell sx={{ fontSize: 12, color: "#6B7280" }}>{f.created_at?.slice(0, 10)}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5}>
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
        <DialogTitle sx={{ fontWeight: 900, fontSize: 16, pr: 5 }}>
          {editId ? "FAQ 수정" : "FAQ 추가"}
          <IconButton onClick={() => setDialogOpen(false)} sx={{ position: "absolute", right: 12, top: 10 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            {alert && <Typography sx={{ fontSize: 12, color: "error.main" }}>{alert}</Typography>}
            <TextField label="질문" size="small" fullWidth value={form.question}
              onChange={(e) => setForm((p) => ({ ...p, question: e.target.value }))} />
            <TextField label="답변" size="small" fullWidth multiline rows={8} value={form.answer}
              onChange={(e) => setForm((p) => ({ ...p, answer: e.target.value }))}
              slotProps={{ input: { style: { fontSize: 13, fontFamily: "inherit", lineHeight: 1.7 } } }}
            />
            <Stack direction="row" spacing={2} alignItems="center">
              <TextField label="노출 순서" size="small" type="number" sx={{ width: 120 }}
                value={form.display_order}
                onChange={(e) => setForm((p) => ({ ...p, display_order: Number(e.target.value) }))} />
              <Stack direction="row" alignItems="center" spacing={1}>
                <Switch checked={form.is_published}
                  onChange={(e) => setForm((p) => ({ ...p, is_published: e.target.checked }))} />
                <Typography sx={{ fontSize: 13 }}>{form.is_published ? "공개" : "비공개"}</Typography>
              </Stack>
            </Stack>
          </Stack>
        </DialogContent>
        <Divider />
        <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ px: 3, py: 1.5 }}>
          <Button variant="outlined" onClick={() => setDialogOpen(false)} sx={{ fontWeight: 700 }}>취소</Button>
          <Button variant="contained" disableElevation disabled={saving} onClick={handleSave}
            sx={{ fontWeight: 700, bgcolor: "#2F80ED", "&:hover": { bgcolor: "#256FD1" } }}>
            {editId ? "수정" : "등록"}
          </Button>
        </Stack>
      </Dialog>
    </Box>
  );
}
