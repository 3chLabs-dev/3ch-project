import { useState } from "react";
import {
  Box, Button, Chip, Dialog, DialogContent,
  Divider, IconButton, Pagination, Stack, Switch,
  Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import PolicyEditor from "../../../components/PolicyEditor";

const API = import.meta.env.VITE_API_BASE_URL ?? "/api";

const NOTICE_CATEGORIES = ["안내", "중요", "약관", "이벤트"] as const;
type NoticeCategory = typeof NOTICE_CATEGORIES[number];

const CATEGORY_STYLE: Record<NoticeCategory, { bgcolor: string; color: string }> = {
  "중요": { bgcolor: "#FFF7ED", color: "#C2410C" },
  "약관": { bgcolor: "#F0F9FF", color: "#0369A1" },
  "이벤트": { bgcolor: "#FDF4FF", color: "#7E22CE" },
  "안내": { bgcolor: "#F3F4F6", color: "#6B7280" },
};

type Notice = {
  id: number;
  category: NoticeCategory;
  title: string;
  content_preview?: string;
  content?: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

type FormState = { category: NoticeCategory; title: string; content: string; is_published: boolean };
const EMPTY_FORM: FormState = { category: "안내", title: "", content: "", is_published: true };

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
    setForm({ category: data.category ?? "안내", title: data.title, content: data.content, is_published: data.is_published });
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
        <Table size="small" sx={{ tableLayout: "fixed", width: "100%" }}>
          <colgroup>
            <col style={{ width: 52 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: "20%" }} />
            <col />
            <col style={{ width: 90 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 110 }} />
          </colgroup>
          <TableHead>
            <TableRow sx={{ bgcolor: "#F9FAFB" }}>
              {(["No", "유형", "제목", "내용 미리보기", "공개", "등록일시", "관리"] as const).map((h) => (
                <TableCell key={h} align={h === "공개" || h === "관리" || h === "유형" ? "center" : "left"}
                  sx={{ fontWeight: 800, fontSize: 12, color: "#374151", py: 1.2, whiteSpace: "nowrap" }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {notices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6, color: "#9CA3AF", fontSize: 13 }}>
                  등록된 공지사항이 없습니다.
                </TableCell>
              </TableRow>
            ) : notices.map((n) => (
              <TableRow key={n.id} hover>
                <TableCell sx={{ fontSize: 12, color: "#6B7280" }}>{n.id}</TableCell>
                <TableCell align="center">
                  <Chip label={n.category ?? "안내"} size="small" sx={{
                    fontSize: 11, fontWeight: 700,
                    ...(CATEGORY_STYLE[n.category as NoticeCategory] ?? CATEGORY_STYLE["안내"]),
                  }} />
                </TableCell>
                <TableCell>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {n.title}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography sx={{ fontSize: 12, color: "#6B7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {n.content_preview}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Chip label={n.is_published ? "공개" : "비공개"} size="small"
                    sx={{ fontSize: 11, fontWeight: 700,
                      bgcolor: n.is_published ? "#D1FAE5" : "#F3F4F6",
                      color:   n.is_published ? "#065F46" : "#6B7280" }} />
                </TableCell>
                <TableCell sx={{ fontSize: 12, color: "#6B7280", whiteSpace: "nowrap" }}>{n.created_at?.slice(0, 10)}</TableCell>
                <TableCell align="center" sx={{ whiteSpace: "nowrap" }}>
                  <Stack direction="row" spacing={0.5} justifyContent="center">
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
        {/* 헤더 */}
        <Box sx={{ px: 3, pt: 3, pb: 2.5, borderBottom: "1px solid #E5E7EB" }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box sx={{
              width: 36, height: 36, borderRadius: 1.5, flexShrink: 0,
              bgcolor: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <CampaignOutlinedIcon sx={{ fontSize: 20, color: "#2F80ED" }} />
            </Box>
            <Box flex={1}>
              <Typography fontWeight={900} fontSize={16} color="#1F2937">
                {editId ? "공지사항 수정" : "공지사항 추가"}
              </Typography>
              <Typography fontSize={12} color="#9CA3AF" fontWeight={500} sx={{ mt: 0.2 }}>
                {editId ? "등록된 공지사항을 수정합니다." : "새로운 공지사항을 작성합니다."}
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

            {/* 유형 */}
            <Box>
              <Typography fontSize={12} fontWeight={700} color="#374151" sx={{ mb: 0.8 }}>유형</Typography>
              <Stack direction="row" spacing={0.8} flexWrap="wrap">
                {NOTICE_CATEGORIES.map((cat) => (
                  <Chip
                    key={cat}
                    label={cat}
                    onClick={() => setForm((p) => ({ ...p, category: cat }))}
                    sx={{
                      fontWeight: 700, fontSize: 12, cursor: "pointer",
                      ...(form.category === cat ? CATEGORY_STYLE[cat] : { bgcolor: "#F3F4F6", color: "#9CA3AF" }),
                      border: form.category === cat ? "1.5px solid" : "1.5px solid transparent",
                      borderColor: form.category === cat ? CATEGORY_STYLE[cat].color : "transparent",
                    }}
                  />
                ))}
              </Stack>
            </Box>

            {/* 제목 */}
            <Box>
              <Typography fontSize={12} fontWeight={700} color="#374151" sx={{ mb: 0.8 }}>
                제목 <Typography component="span" color="error" fontSize={12}>*</Typography>
              </Typography>
              <TextField
                size="small" fullWidth
                placeholder="공지사항 제목을 입력하세요."
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                inputProps={{ maxLength: 200 }}
              />
              <Typography fontSize={11} color="#9CA3AF" textAlign="right" sx={{ mt: 0.5 }}>
                {form.title.length}/200
              </Typography>
            </Box>

            {/* 내용 */}
            <Box>
              <Typography fontSize={12} fontWeight={700} color="#374151" sx={{ mb: 0.8 }}>
                내용 <Typography component="span" color="error" fontSize={12}>*</Typography>
              </Typography>
              <PolicyEditor
                value={form.content}
                onChange={(html) => setForm((p) => ({ ...p, content: html }))}
                minHeight={320}
              />
            </Box>

            {/* 공개 설정 */}
            <Box sx={{ bgcolor: "#F9FAFB", borderRadius: 1.5, px: 2.5, py: 2, border: "1px solid #E5E7EB" }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography fontSize={13} fontWeight={700} color="#374151">공개 여부</Typography>
                  <Typography fontSize={12} color="#9CA3AF" sx={{ mt: 0.3 }}>
                    비공개 시 사용자에게 노출되지 않습니다.
                  </Typography>
                </Box>
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
