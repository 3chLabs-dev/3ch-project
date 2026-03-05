import { useState } from "react";
import {
  Box, Button, Chip, Dialog, DialogContent,
  Divider, IconButton, Pagination, Stack,
  Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import QuestionAnswerOutlinedIcon from "@mui/icons-material/QuestionAnswerOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";

const API = import.meta.env.VITE_API_BASE_URL ?? "/api";

type Inquiry = {
  id: number;
  category?: string;
  title: string;
  content?: string;
  contact_email?: string | null;
  phone?: string | null;
  attachment_path?: string | null;
  status: "pending" | "answered";
  reply?: string | null;
  replied_at?: string | null;
  created_at: string;
  user_name?: string;
  user_email?: string;
};

function useAdminToken() {
  return localStorage.getItem("admin_token") ?? "";
}

export default function AdminInquiryPage() {
  const token = useAdminToken();
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const [items, setItems]   = useState<Inquiry[]>([]);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [loaded, setLoaded] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected]     = useState<Inquiry | null>(null);
  const [reply, setReply]           = useState("");
  const [saving, setSaving]         = useState(false);
  const [alert, setAlert]           = useState("");

  const LIMIT = 15;

  const load = async (p = page) => {
    const res  = await fetch(`${API}/admin/board/inquiries?page=${p}&limit=${LIMIT}`, { headers });
    const data = await res.json();
    setItems(data.inquiries ?? []);
    setTotal(data.total ?? 0);
    setLoaded(true);
  };

  if (!loaded) load(1);

  const openDetail = async (id: number) => {
    const res  = await fetch(`${API}/admin/board/inquiries/${id}`, { headers });
    const data = await res.json();
    setSelected(data);
    setReply(data.reply ?? "");
    setAlert("");
    setDialogOpen(true);
  };

  const handleReply = async () => {
    if (!reply.trim()) { setAlert("답변 내용을 입력하세요."); return; }
    if (!selected) return;
    setSaving(true);
    const res = await fetch(`${API}/admin/board/inquiries/${selected.id}/reply`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ reply: reply.trim() }),
    });
    setSaving(false);
    if (!res.ok) { setAlert((await res.json()).message ?? "오류"); return; }
    setDialogOpen(false);
    load(page);
  };

  const handlePageChange = (_: unknown, p: number) => { setPage(p); load(p); };

  return (
    <Box sx={{ p: 3 }}>
      <Typography sx={{ fontSize: 18, fontWeight: 900, mb: 2, color: "#1F2937" }}>1:1 문의</Typography>

      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography sx={{ fontSize: 13, color: "#6B7280", fontWeight: 600 }}>
          총 <b>{total}</b>개
        </Typography>
      </Stack>

      <Box sx={{ border: "1px solid #E5E7EB", borderRadius: 1.5, overflow: "hidden" }}>
        <Table size="small" sx={{ tableLayout: "fixed", width: "100%" }}>
          <colgroup>
            <col style={{ width: 52 }} />
            <col />
            <col style={{ width: 110 }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 72 }} />
          </colgroup>
          <TableHead>
            <TableRow sx={{ bgcolor: "#F9FAFB" }}>
              {(["No", "제목", "문의유형", "작성자", "상태", "등록일시", "관리"] as const).map((h) => (
                <TableCell key={h} align={h === "상태" || h === "관리" || h === "문의유형" ? "center" : "left"}
                  sx={{ fontWeight: 800, fontSize: 12, color: "#374151", py: 1.2 }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6, color: "#9CA3AF", fontSize: 13 }}>
                  등록된 문의사항이 없습니다.
                </TableCell>
              </TableRow>
            ) : items.map((item) => (
              <TableRow key={item.id} hover>
                <TableCell sx={{ fontSize: 12, color: "#6B7280" }}>{item.id}</TableCell>
                <TableCell>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.title}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  {item.category ? (
                    <Chip label={item.category} size="small"
                      sx={{ fontSize: 11, fontWeight: 700, bgcolor: "#EEF2FF", color: "#4338CA" }} />
                  ) : <Typography fontSize={12} color="#9CA3AF">-</Typography>}
                </TableCell>
                <TableCell>
                  <Typography sx={{ fontSize: 12, color: "#6B7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.user_name ?? item.user_email ?? "-"}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Chip
                    label={item.status === "answered" ? "답변완료" : "대기중"}
                    size="small"
                    sx={{
                      fontSize: 11, fontWeight: 700,
                      bgcolor: item.status === "answered" ? "#D1FAE5" : "#FEF3C7",
                      color:   item.status === "answered" ? "#065F46" : "#92400E",
                    }}
                  />
                </TableCell>
                <TableCell sx={{ fontSize: 12, color: "#6B7280", whiteSpace: "nowrap" }}>{item.created_at?.slice(0, 10)}</TableCell>
                <TableCell align="center" sx={{ whiteSpace: "nowrap" }}>
                  <Button
                    size="small"
                    onClick={() => openDetail(item.id)}
                    sx={{ fontSize: 11, fontWeight: 700, minWidth: 0, px: 1 }}
                  >
                    {item.status === "answered" ? "보기" : "답변"}
                  </Button>
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

      {/* 상세 / 답변 다이얼로그 */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="md">
        {/* 헤더 */}
        <Box sx={{ px: 3, pt: 3, pb: 2.5, borderBottom: "1px solid #E5E7EB" }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box sx={{
              width: 36, height: 36, borderRadius: 1.5, flexShrink: 0,
              bgcolor: selected?.status === "answered" ? "#F0FDF4" : "#FFFBEB",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <QuestionAnswerOutlinedIcon sx={{ fontSize: 20, color: selected?.status === "answered" ? "#059669" : "#D97706" }} />
            </Box>
            <Box flex={1}>
              <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                {selected?.category && (
                  <Chip label={selected.category} size="small"
                    sx={{ fontSize: 11, fontWeight: 700, bgcolor: "#EEF2FF", color: "#4338CA" }} />
                )}
                <Chip
                  label={selected?.status === "answered" ? "답변완료" : "대기중"}
                  size="small"
                  sx={{
                    fontSize: 11, fontWeight: 700,
                    bgcolor: selected?.status === "answered" ? "#D1FAE5" : "#FEF3C7",
                    color:   selected?.status === "answered" ? "#065F46" : "#92400E",
                  }}
                />
                <Typography fontSize={12} color="#9CA3AF" fontWeight={500}>
                  {selected?.user_name ?? selected?.user_email ?? "-"}
                  {selected?.created_at ? ` · ${selected.created_at.slice(0, 10)}` : ""}
                </Typography>
              </Stack>
              <Typography fontWeight={900} fontSize={15} color="#1F2937" sx={{ mt: 0.6 }}>
                {selected?.title}
              </Typography>
            </Box>
            <IconButton size="small" onClick={() => setDialogOpen(false)} sx={{ color: "#6B7280", alignSelf: "flex-start" }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Box>

        <DialogContent sx={{ px: 3, py: 3 }}>
          <Stack spacing={3}>
            {/* 연락처 */}
            {(selected?.contact_email || selected?.phone) && (
              <Box sx={{ bgcolor: "#F9FAFB", borderRadius: 1.5, px: 2.5, py: 1.8, border: "1px solid #E5E7EB" }}>
                <Typography fontSize={11} fontWeight={700} color="#9CA3AF" sx={{ mb: 0.8, letterSpacing: 0.5 }}>연락처</Typography>
                <Stack spacing={0.4}>
                  {selected.contact_email && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography fontSize={11} fontWeight={700} color="#6B7280" sx={{ minWidth: 40 }}>이메일</Typography>
                      <Typography fontSize={13} color="#374151">{selected.contact_email}</Typography>
                    </Stack>
                  )}
                  {selected.phone && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography fontSize={11} fontWeight={700} color="#6B7280" sx={{ minWidth: 40 }}>전화</Typography>
                      <Typography fontSize={13} color="#374151">{selected.phone}</Typography>
                    </Stack>
                  )}
                </Stack>
              </Box>
            )}

            {/* 첨부파일 */}
            {selected?.attachment_path && (
              <Box sx={{ bgcolor: "#F9FAFB", borderRadius: 1.5, px: 2.5, py: 1.8, border: "1px solid #E5E7EB" }}>
                <Typography fontSize={11} fontWeight={700} color="#9CA3AF" sx={{ mb: 0.8, letterSpacing: 0.5 }}>첨부파일</Typography>
                <Box
                  component="a"
                  href={`${import.meta.env.VITE_API_BASE_URL?.replace("/api", "") ?? ""}${selected.attachment_path}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ display: "flex", alignItems: "center", gap: 1, color: "#2F80ED", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
                >
                  <InsertDriveFileOutlinedIcon sx={{ fontSize: 16 }} />
                  <Typography fontSize={13} fontWeight={600} color="#2F80ED">
                    {selected.attachment_path.split("/").pop()}
                  </Typography>
                </Box>
              </Box>
            )}

            {/* 문의 내용 */}
            <Box>
              <Typography fontSize={12} fontWeight={700} color="#374151" sx={{ mb: 0.8 }}>문의 내용</Typography>
              <Box sx={{ bgcolor: "#F9FAFB", borderRadius: 1.5, p: 2.5, border: "1px solid #E5E7EB" }}>
                <Typography sx={{ whiteSpace: "pre-line", fontSize: 14, lineHeight: 1.9, color: "#374151" }}>
                  {selected?.content}
                </Typography>
              </Box>
            </Box>

            <Divider />

            {/* 답변 */}
            <Box>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                {selected?.status === "answered"
                  ? <CheckCircleOutlineIcon sx={{ fontSize: 16, color: "#059669" }} />
                  : <AccessTimeIcon sx={{ fontSize: 16, color: "#D97706" }} />
                }
                <Typography fontSize={12} fontWeight={700} color="#374151">
                  {selected?.status === "answered" ? "답변 수정" : "답변 작성"}
                </Typography>
                {selected?.replied_at && (
                  <Typography fontSize={11} color="#9CA3AF" fontWeight={500}>
                    {selected.replied_at.slice(0, 10)} 작성
                  </Typography>
                )}
              </Stack>
              <TextField
                fullWidth multiline rows={6} size="small"
                placeholder="답변을 입력하세요."
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                slotProps={{ input: { style: { fontSize: 13, fontFamily: "inherit", lineHeight: 1.8 } } }}
              />
            </Box>

            {alert && (
              <Box sx={{ bgcolor: "#FEF2F2", borderRadius: 1, px: 2, py: 1.2, border: "1px solid #FECACA" }}>
                <Typography fontSize={13} color="#DC2626" fontWeight={600}>{alert}</Typography>
              </Box>
            )}
          </Stack>
        </DialogContent>

        <Box sx={{ px: 3, py: 2, borderTop: "1px solid #E5E7EB", bgcolor: "#F9FAFB" }}>
          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button
              variant="outlined" onClick={() => setDialogOpen(false)}
              sx={{ fontWeight: 700, borderColor: "#D1D5DB", color: "#374151", "&:hover": { borderColor: "#9CA3AF", bgcolor: "#F3F4F6" } }}
            >
              닫기
            </Button>
            <Button
              variant="contained" disableElevation disabled={saving} onClick={handleReply}
              sx={{ fontWeight: 700, px: 3, bgcolor: "#2F80ED", "&:hover": { bgcolor: "#256FD1" } }}
            >
              {saving ? "저장 중..." : selected?.status === "answered" ? "답변 수정" : "답변 등록"}
            </Button>
          </Stack>
        </Box>
      </Dialog>
    </Box>
  );
}
