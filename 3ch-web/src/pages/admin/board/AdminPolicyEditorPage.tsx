import { useState } from "react";
import {
  Box, Button, Chip, Dialog, DialogContent, DialogTitle,
  Divider, IconButton, Stack,
  Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

const API = import.meta.env.VITE_API_BASE_URL ?? "/api";

type PolicyType = "terms" | "privacy";

type Version = {
  id: number;
  label: string;
  effective_date: string;
  body_preview?: string;
  body?: string;
  is_current: boolean;
  created_at: string;
};

type FormState = { label: string; effective_date: string; body: string; set_current: boolean };
const EMPTY_FORM: FormState = { label: "", effective_date: "", body: "", set_current: false };

function useAdminToken() {
  return localStorage.getItem("admin_token") ?? "";
}

type Props = { type: PolicyType; title: string };

export default function AdminPolicyEditorPage({ type, title }: Props) {
  const token   = useAdminToken();
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const [versions, setVersions] = useState<Version[]>([]);
  const [loaded, setLoaded]     = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId]     = useState<number | null>(null);
  const [form, setForm]         = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [alert, setAlert]       = useState("");

  const load = async () => {
    const res  = await fetch(`${API}/admin/board/policies/${type}`, { headers });
    const data = await res.json();
    setVersions(data.versions ?? []);
    setLoaded(true);
  };

  if (!loaded) load();

  const openAdd = () => { setEditId(null); setForm(EMPTY_FORM); setAlert(""); setDialogOpen(true); };

  const openEdit = async (id: number) => {
    const res  = await fetch(`${API}/admin/board/policies/${type}/${id}`, { headers });
    const data = await res.json();
    setEditId(id);
    setForm({ label: data.label, effective_date: data.effective_date, body: data.body, set_current: data.is_current });
    setAlert("");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.label.trim() || !form.effective_date.trim() || !form.body.trim()) {
      setAlert("모든 항목을 입력하세요."); return;
    }
    setSaving(true);
    const url    = editId ? `${API}/admin/board/policies/${type}/${editId}` : `${API}/admin/board/policies/${type}`;
    const method = editId ? "PUT" : "POST";
    // PUT 시엔 set_current 없음 (별도 패치)
    const body   = editId
      ? { label: form.label, effective_date: form.effective_date, body: form.body }
      : form;
    const res = await fetch(url, { method, headers, body: JSON.stringify(body) });
    setSaving(false);
    if (!res.ok) { setAlert((await res.json()).message ?? "오류"); return; }
    setDialogOpen(false);
    load();
  };

  const handleSetCurrent = async (id: number) => {
    if (!confirm("이 버전을 현행으로 설정하시겠습니까?")) return;
    await fetch(`${API}/admin/board/policies/${type}/${id}/set-current`, { method: "PATCH", headers });
    load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("삭제하시겠습니까?\n(현행 버전은 삭제할 수 없습니다.)")) return;
    const res = await fetch(`${API}/admin/board/policies/${type}/${id}`, { method: "DELETE", headers });
    if (!res.ok) { alert((await res.json()).message); return; }
    load();
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography sx={{ fontSize: 18, fontWeight: 900, mb: 2, color: "#1F2937" }}>{title}</Typography>

      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography sx={{ fontSize: 13, color: "#6B7280", fontWeight: 600 }}>
          총 <b>{versions.length}</b>개 버전
        </Typography>
        <Button variant="contained" size="small" disableElevation onClick={openAdd}
          sx={{ fontWeight: 700, borderRadius: 1, bgcolor: "#2F80ED", "&:hover": { bgcolor: "#256FD1" } }}>
          신규 버전 추가
        </Button>
      </Stack>

      <Box sx={{ border: "1px solid #E5E7EB", borderRadius: 1.5, overflow: "hidden" }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "#F9FAFB" }}>
              {["No", "버전 레이블", "시행일", "내용 미리보기", "상태", "등록일시", "관리"].map((h) => (
                <TableCell key={h} sx={{ fontWeight: 800, fontSize: 12, color: "#374151", py: 1.2 }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {versions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6, color: "#9CA3AF", fontSize: 13 }}>
                  등록된 버전이 없습니다.
                </TableCell>
              </TableRow>
            ) : versions.map((v) => (
              <TableRow key={v.id} hover sx={{ bgcolor: v.is_current ? "#F0F9FF" : undefined }}>
                <TableCell sx={{ fontSize: 12, color: "#6B7280" }}>{v.id}</TableCell>
                <TableCell sx={{ fontSize: 12, fontWeight: 700 }}>{v.label}</TableCell>
                <TableCell sx={{ fontSize: 12 }}>{v.effective_date}</TableCell>
                <TableCell sx={{ maxWidth: 260 }}>
                  <Typography sx={{ fontSize: 12, color: "#6B7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 260 }}>
                    {v.body_preview}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={v.is_current ? "현행" : "이전"}
                    size="small"
                    sx={{ fontSize: 11, fontWeight: 700,
                      bgcolor: v.is_current ? "#DBEAFE" : "#F3F4F6",
                      color:   v.is_current ? "#1D4ED8" : "#6B7280" }}
                  />
                </TableCell>
                <TableCell sx={{ fontSize: 12, color: "#6B7280" }}>{v.created_at?.slice(0, 10)}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5}>
                    <Button size="small" onClick={() => openEdit(v.id)}
                      sx={{ fontSize: 11, fontWeight: 700, minWidth: 0, px: 1 }}>수정</Button>
                    {!v.is_current && (
                      <Button size="small" onClick={() => handleSetCurrent(v.id)}
                        sx={{ fontSize: 11, fontWeight: 700, minWidth: 0, px: 1, color: "#059669" }}>
                        현행설정
                      </Button>
                    )}
                    {!v.is_current && (
                      <Button size="small" color="error" onClick={() => handleDelete(v.id)}
                        sx={{ fontSize: 11, fontWeight: 700, minWidth: 0, px: 1 }}>삭제</Button>
                    )}
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
          {editId ? `${title} 수정` : `${title} 신규 버전 추가`}
          <IconButton onClick={() => setDialogOpen(false)} sx={{ position: "absolute", right: 12, top: 10 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            {alert && <Typography sx={{ fontSize: 12, color: "error.main" }}>{alert}</Typography>}
            <Stack direction="row" spacing={2}>
              <TextField label="버전 레이블" size="small" fullWidth value={form.label}
                placeholder="예) 현행 이용약관"
                onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))} />
              <TextField label="시행일" size="small" fullWidth value={form.effective_date}
                placeholder="예) 2026년 2월 14일 시행"
                onChange={(e) => setForm((p) => ({ ...p, effective_date: e.target.value }))} />
            </Stack>
            <TextField
              label="내용"
              size="small"
              fullWidth
              multiline
              rows={20}
              value={form.body}
              onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
              onPaste={(e) => {
                const text = e.clipboardData.getData("text");
                const hasEscaped = /\\r\\n|\\n|\\r/.test(text);
                if (!hasEscaped) return;
                e.preventDefault();
                const normalized = text.replace(/\\r\\n/g, "\n").replace(/\\r/g, "\n").replace(/\\n/g, "\n");
                const el = e.currentTarget.querySelector("textarea");
                if (!el) { setForm((p) => ({ ...p, body: normalized })); return; }
                const start = el.selectionStart ?? 0;
                const end   = el.selectionEnd   ?? 0;
                const next  = form.body.slice(0, start) + normalized + form.body.slice(end);
                setForm((p) => ({ ...p, body: next }));
                requestAnimationFrame(() => {
                  const pos = start + normalized.length;
                  el.setSelectionRange(pos, pos);
                });
              }}
              slotProps={{ input: { style: { fontSize: 13, fontFamily: "inherit", lineHeight: 1.75 } } }}
              helperText="줄바꿈은 그대로 반영됩니다."
            />
            {!editId && (
              <Stack direction="row" alignItems="center" spacing={1}>
                <input type="checkbox" id="set_current" checked={form.set_current}
                  onChange={(e) => setForm((p) => ({ ...p, set_current: e.target.checked }))} />
                <Typography component="label" htmlFor="set_current" sx={{ fontSize: 13, cursor: "pointer" }}>
                  저장 즉시 현행 버전으로 설정
                </Typography>
              </Stack>
            )}
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
