import { useState } from "react";
import {
  Box, Button, Chip, Dialog, DialogContent, DialogTitle,
  Divider, IconButton, Pagination, Stack, Switch,
  Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

const API = import.meta.env.VITE_API_BASE_URL ?? "/api";

type Notice = {
  id: number;
  title: string;
  content_preview?: string;
  content?: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

type FormState = { title: string; content: string; is_published: boolean };
const EMPTY_FORM: FormState = { title: "", content: "", is_published: true };

function useAdminToken() {
  return localStorage.getItem("admin_token") ?? "";
}

export default function AdminNoticePage() {
  const token = useAdminToken();
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const [notices, setNotices]   = useState<Notice[]>([]);
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
    const res = await fetch(`${API}/admin/board/notices?page=${p}&limit=${LIMIT}`, { headers });
    const data = await res.json();
    setNotices(data.notices ?? []);
    setTotal(data.total ?? 0);
    setLoaded(true);
  };

  if (!loaded) load(1);

  const openAdd = () => { setEditId(null); setForm(EMPTY_FORM); setAlert(""); setDialogOpen(true); };

  const openEdit = async (id: number) => {
    const res  = await fetch(`${API}/admin/board/notices/${id}`, { headers });
    const data = await res.json();
    setEditId(id);
    setForm({ title: data.title, content: data.content, is_published: data.is_published });
    setAlert("");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) { setAlert("제목과 내용을 입력하세요."); return; }
    setSaving(true);
    const url    = editId ? `${API}/admin/board/notices/${editId}` : `${API}/admin/board/notices`;
    const method = editId ? "PUT" : "POST";
    const res    = await fetch(url, { method, headers, body: JSON.stringify(form) });
    setSaving(false);
    if (!res.ok) { setAlert((await res.json()).message ?? "오류"); return; }
    setDialogOpen(false);
    load(page);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("삭제하시겠습니까?")) return;
    await fetch(`${API}/admin/board/notices/${id}`, { method: "DELETE", headers });
    load(page);
  };

  const handlePageChange = (_: unknown, p: number) => { setPage(p); load(p); };

  return (
    <Box sx={{ p: 3 }}>
      <Typography sx={{ fontSize: 18, fontWeight: 900, mb: 2, color: "#1F2937" }}>공지사항</Typography>

      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography sx={{ fontSize: 13, color: "#6B7280", fontWeight: 600 }}>
          총 <b>{total}</b>개
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
              {["No", "제목", "내용 미리보기", "공개", "등록일시", "관리"].map((h) => (
                <TableCell key={h} sx={{ fontWeight: 800, fontSize: 12, color: "#374151", py: 1.2 }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {notices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6, color: "#9CA3AF", fontSize: 13 }}>
                  등록된 공지사항이 없습니다.
                </TableCell>
              </TableRow>
            ) : notices.map((n) => (
              <TableRow key={n.id} hover>
                <TableCell sx={{ fontSize: 12, color: "#6B7280" }}>{n.id}</TableCell>
                <TableCell sx={{ fontSize: 12, fontWeight: 700, maxWidth: 180 }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>
                    {n.title}
                  </Typography>
                </TableCell>
                <TableCell sx={{ fontSize: 12, color: "#6B7280", maxWidth: 260 }}>
                  <Typography sx={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 260 }}>
                    {n.content_preview}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip label={n.is_published ? "공개" : "비공개"} size="small"
                    sx={{ fontSize: 11, fontWeight: 700,
                      bgcolor: n.is_published ? "#D1FAE5" : "#F3F4F6",
                      color:   n.is_published ? "#065F46" : "#6B7280" }} />
                </TableCell>
                <TableCell sx={{ fontSize: 12, color: "#6B7280" }}>{n.created_at?.slice(0, 10)}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5}>
                    <Button size="small" onClick={() => openEdit(n.id)}
                      sx={{ fontSize: 11, fontWeight: 700, minWidth: 0, px: 1 }}>수정</Button>
                    <Button size="small" color="error" onClick={() => handleDelete(n.id)}
                      sx={{ fontSize: 11, fontWeight: 700, minWidth: 0, px: 1 }}>삭제</Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>

      <Stack alignItems="center" mt={2}>
        <Pagination count={Math.max(1, Math.ceil(total / LIMIT))} page={page}
          size="small" shape="rounded" onChange={handlePageChange} />
      </Stack>

      {/* 추가/수정 다이얼로그 */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontWeight: 900, fontSize: 16, pr: 5 }}>
          {editId ? "공지사항 수정" : "공지사항 추가"}
          <IconButton onClick={() => setDialogOpen(false)} sx={{ position: "absolute", right: 12, top: 10 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            {alert && <Typography sx={{ fontSize: 12, color: "error.main" }}>{alert}</Typography>}
            <TextField label="제목" size="small" fullWidth value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
            <TextField label="내용" size="small" fullWidth multiline rows={14} value={form.content}
              onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
              slotProps={{ input: { style: { fontSize: 13, fontFamily: "inherit", lineHeight: 1.7 } } }}
            />
            <Stack direction="row" alignItems="center" spacing={1}>
              <Switch checked={form.is_published}
                onChange={(e) => setForm((p) => ({ ...p, is_published: e.target.checked }))} />
              <Typography sx={{ fontSize: 13 }}>{form.is_published ? "공개" : "비공개"}</Typography>
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
