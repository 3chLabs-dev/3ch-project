import { loginUrl } from "../../utils/returnNavigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogContent, DialogTitle, IconButton, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import CloseIcon from "@mui/icons-material/Close";
import { useNavigate } from "react-router-dom";
import { useAppSelector } from "../../app/hooks";

const API = import.meta.env.VITE_API_BASE_URL ?? "/api";
type Application = { id: number; title: string; status: string; created_at: string; content?: string; reply?: string; replied_at?: string };
const initialForm = { account_email: "", club_created: "", club_name: "", season_configured: "", photo_url: "", contact: "", preferred_at: "" };

function YesNoButtons({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <Stack spacing={1}>
    <Typography fontSize={14} fontWeight={700}>{label} <Box component="span" color="error.main">*</Box></Typography>
    <ToggleButtonGroup exclusive fullWidth value={value} aria-label={label} onChange={(_, next: string | null) => { if (next) onChange(next); }}
      sx={{ borderRadius: 2, "& .MuiToggleButton-root": { flex: 1, py: 1.5, textTransform: "none", color: "text.secondary", borderColor: "#D1D5DB", "&.Mui-selected": { bgcolor: "#EBEBEB", color: "text.primary", fontWeight: 700, "&:hover": { bgcolor: "#E2E2E2" } } } }}>
      <ToggleButton value="yes">예</ToggleButton><ToggleButton value="no">아니오 (직접 해주세요)</ToggleButton>
    </ToggleButtonGroup>
  </Stack>;
}

export default function ResultApplicationPage() {
  const navigate = useNavigate();
  const token = useAppSelector(s => s.auth.token);
  const user = useAppSelector(s => s.auth.user);
  const [items, setItems] = useState<Application[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [writeOpen, setWriteOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [detail, setDetail] = useState<Application | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const request = useCallback(async (path: string, options: RequestInit = {}) => {
    const response = await fetch(`${API}${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "요청에 실패했습니다. 다시 시도해주세요.");
    return data;
  }, [token]);
  const load = useCallback(async () => {
    if (!token) { setItems([]); setDetail(null); setWriteOpen(false); return; }
    setLoading(true); setError("");
    try { setItems((await request("/result-applications/my")).applications); }
    catch (e) { setError(e instanceof Error ? e.message : "신청 목록을 불러오지 못했습니다."); }
    finally { setLoading(false); }
  }, [request, token]);
  useEffect(() => { void load(); }, [load]);
  const openDetail = async (id: number) => {
    setDetailLoading(true); setError("");
    try { setDetail(await request(`/result-applications/my/${id}`)); }
    catch (e) { setError(e instanceof Error ? e.message : "신청을 불러오지 못했습니다."); }
    finally { setDetailLoading(false); }
  };
  const submit = async () => {
    if (!form.account_email.trim() || !form.club_created || (form.club_created === "yes" && (!form.club_name.trim() || !form.season_configured))) {
      setFormError("필수 항목을 모두 입력해주세요."); return;
    }
    setSaving(true); setFormError("");
    try {
      await request("/result-applications", { method: "POST", body: JSON.stringify({ ...form, club_created: form.club_created === "yes", season_configured: form.club_created === "yes" ? form.season_configured === "yes" : null }) });
      setWriteOpen(false); await load();
    } catch (e) { setFormError(e instanceof Error ? e.message : "신청 등록에 실패했습니다."); }
    finally { setSaving(false); }
  };
  return <Stack spacing={2.5}>
    <Stack direction="row" alignItems="center" spacing={1}>
      <IconButton onClick={() => navigate("/mypage")}><ChevronLeftIcon /></IconButton>
      <Typography variant="h6" fontWeight={900} flex={1}>결과 등록 신청</Typography>
      {token && <Button variant="contained" onClick={() => { setForm({ ...initialForm, account_email: user?.email || "" }); setFormError(""); setWriteOpen(true); }}>신청하기</Button>}
    </Stack>
    <Typography color="text.secondary" fontSize={14}>클럽 순위에 필요한 정보를 적어주세요. 신청 내용과 관리자 답변은 본인만 확인할 수 있습니다.</Typography>
    {!token && <Card sx={{ borderRadius: 2, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
      <CardContent>
        <Stack alignItems="center" spacing={1.2}>
          <Typography fontWeight={800}>로그인을 해주세요.</Typography>
          <Button variant="contained" size="medium" onClick={() => navigate(loginUrl())} sx={{ px: 3, borderRadius: 1 }}>로그인</Button>
        </Stack>
      </CardContent>
    </Card>}
    {error && <Alert severity="error" action={<Button onClick={() => void load()}>다시 시도</Button>}>{error}</Alert>}
    {(loading || detailLoading) && <Typography>불러오는 중...</Typography>}
    {token && !loading && !error && !items.length && <Typography color="text.secondary" textAlign="center" py={5}>접수한 신청이 없습니다.</Typography>}
    {items.map(item => <Card key={item.id} variant="outlined"><CardContent>
      <Stack direction="row" alignItems="center" spacing={1}><Typography fontWeight={700} flex={1}>{item.title}</Typography><Chip size="small" label={item.status === "answered" ? "답변완료" : "대기중"} color={item.status === "answered" ? "success" : "warning"} /></Stack>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mt={1}><Typography fontSize={12} color="text.secondary">{item.created_at.slice(0, 10)}</Typography><Button disabled={detailLoading} onClick={() => void openDetail(item.id)}>내용 및 답변 보기</Button></Stack>
    </CardContent></Card>)}
    <Dialog open={writeOpen} onClose={() => { if (!saving) setWriteOpen(false); }} fullWidth maxWidth="sm">
      <DialogTitle><Stack direction="row" alignItems="center"><Typography fontWeight={900} flex={1}>결과 등록 신청</Typography><IconButton disabled={saving} aria-label="닫기" onClick={() => setWriteOpen(false)}><CloseIcon /></IconButton></Stack></DialogTitle>
      <DialogContent><Box component="form" onSubmit={e => { e.preventDefault(); if (!saving) void submit(); }}><Stack spacing={3} pt={1}>
        <TextField required type="email" label="이메일 형태의 아이디(소셜 계정)" value={form.account_email} onChange={e => setForm({ ...form, account_email: e.target.value })} inputProps={{ maxLength: 200 }} />
        <Typography fontWeight={800}>1. 클럽 생성</Typography>
        <YesNoButtons label="클럽을 생성하셨나요?" value={form.club_created} onChange={value => setForm({ ...form, club_created: value, club_name: "", season_configured: "", photo_url: "" })} />
        {form.club_created === "yes" && <>
          <TextField required label="클럽명을 적어주세요." value={form.club_name} onChange={e => setForm({ ...form, club_name: e.target.value })} inputProps={{ maxLength: 100 }} slotProps={{ inputLabel: { required: false } }} />
          <Typography fontWeight={800}>2. 시즌 설정</Typography>
          <Stack direction="row" spacing={2} alignItems="flex-start">
            <Box component="img" src="/images/result-application-season-setting.png" alt="시즌명, 기간과 기본 포인트를 입력하는 순위 시즌 설정 화면"
              sx={{ width: { xs: 112 * 2 / 3, sm: 96 }, height: "auto", flexShrink: 0, borderRadius: 2, border: "1px solid", borderColor: "divider" }} />
            <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
              <Typography fontSize={13} color="text.secondary" lineHeight={1.8}>클럽 &gt; 순위 &gt; 시즌 설정 &gt; 시즌 생성으로 이동해주세요.</Typography>
              <Typography fontSize={13} color="text.secondary" lineHeight={1.8}>시즌명과 기간을 입력하고, 기본 포인트와 입상자 포인트를 설정한 뒤 완료를 눌러주세요.</Typography>
            </Stack>
          </Stack>
          <YesNoButtons label="시즌 설정을 다 하셨나요?" value={form.season_configured} onChange={value => setForm({ ...form, season_configured: value, photo_url: "" })} />
        </>}
        {form.club_created === "yes" && form.season_configured === "yes" && <>
          <Typography fontWeight={800}>3. 대진표 사진 등록</Typography>
          <Typography fontSize={13} color="text.secondary">대진표 사진을 구글 드라이브에 올리거나, 사진을 올린 네이버 밴드·소모임의 초대 링크를 입력해주세요. 공유 설정은 ‘전체 공개(링크가 있는 모든 사용자)’로 설정해주세요.</Typography>
          <TextField type="url" label="공유 링크를 적어주세요. (선택사항)" value={form.photo_url} onChange={e => setForm({ ...form, photo_url: e.target.value })} inputProps={{ maxLength: 2000 }} />
        </>}
        <Stack spacing={2} sx={{ bgcolor: "#F3F4F6", borderRadius: 2, p: { xs: 2, sm: 2.5 } }}>
        <Typography fontSize={13} fontWeight={700} color="text.secondary">직접 찾아뵙거나 메신저로 자세히 설명해 드리겠습니다.</Typography>
        <TextField label="전화번호 또는 카카오톡 ID (선택사항)" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} inputProps={{ maxLength: 200 }} />
        <TextField inputRef={dateInputRef} type="datetime-local" label="방문 희망 일시 (선택사항)" value={form.preferred_at} onChange={e => setForm({ ...form, preferred_at: e.target.value })}
          onClick={() => { const input = dateInputRef.current; if (!input) return; input.focus(); try { input.showPicker?.(); } catch { /* Native keyboard remains available when a picker is unsupported. */ } }}
          sx={{ "& .MuiInputBase-root, & input": { cursor: "pointer" } }} slotProps={{ inputLabel: { shrink: true } }} />
        </Stack>
        {formError && <Alert severity="error">{formError}</Alert>}
        <Button type="submit" variant="contained" disabled={saving}>{saving ? "접수 중..." : "신청 등록"}</Button>
      </Stack></Box></DialogContent>
    </Dialog>
    <Dialog open={!!detail} onClose={() => setDetail(null)} fullWidth maxWidth="sm">
      <DialogTitle><Stack direction="row" alignItems="center"><Typography fontWeight={900} flex={1}>{detail?.title}</Typography><IconButton aria-label="닫기" onClick={() => setDetail(null)}><CloseIcon /></IconButton></Stack></DialogTitle>
      <DialogContent><Stack spacing={3}><Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{detail?.content}</Typography>
        <Box sx={{ bgcolor: detail?.reply ? "#F0FDF4" : "#FFFBEB", p: 2, borderRadius: 1 }}><Typography fontWeight={800}>관리자 답변</Typography><Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", mt: 1 }}>{detail?.reply || "아직 답변이 등록되지 않았습니다."}</Typography>{detail?.replied_at && <Typography fontSize={12} mt={1}>{detail.replied_at.slice(0, 10)}</Typography>}</Box>
      </Stack></DialogContent>
    </Dialog>
  </Stack>;
}
