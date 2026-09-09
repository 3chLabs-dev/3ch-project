import { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";

const API = import.meta.env.VITE_API_BASE_URL ?? "/api";
const TYPES: Record<string, string> = { FREE_MONTHS: "구독 무료 이용권", PERCENT_DISCOUNT: "구독 할인권", LEAGUE_CREATE: "리그 생성 지급권", VISION_SCAN: "사진 인식 지급권", RANKING_SEASON_CREATE: "시즌 생성 지급권", DRAW_CREATE: "추첨 생성 지급권" };
type Plan = { code: string; name: string };
type Use = { id: number; name: string; email: string; redeemed_at: string; clubs: { id: string; name: string }[] };
type Coupon = { id: string; code: string; name: string; type: string; value: number; plan_code: string | null; valid_from: string; valid_until: string; is_active: boolean; distribution_type: string; max_redemptions: number | null; redemption_count: number; redemptions: Use[] };
type CouponForm = { name: string; type: string; value: number; planCode: string; validFrom: string; validUntil: string; distributionType: string; customCode: string; maxRedemptions: string };
const formatDate = (value: string) => new Date(value).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
const blankForm = (): CouponForm => ({ name: "", type: "FREE_MONTHS", value: 1, planCode: "", validFrom: formatDate(new Date().toISOString()), validUntil: "", distributionType: "SINGLE", customCode: "", maxRedemptions: "" });

export default function AdminCouponPage() {
  const token = localStorage.getItem("admin_token") ?? "";
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  const [rows, setRows] = useState<Coupon[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [detail, setDetail] = useState<Coupon | null>(null);
  const [form, setForm] = useState<CouponForm>(blankForm);
  const [error, setError] = useState("");
  const load = useCallback(async () => { const response = await fetch(`${API}/admin/coupons?search=${encodeURIComponent(search)}`, { headers }); const data = await response.json(); response.ok ? setRows(data.coupons ?? []) : setError("목록을 불러오지 못했습니다."); }, [search]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { fetch(`${API}/admin/pricing-plans`, { headers }).then((response) => response.json()).then((data) => setPlans(data.plans ?? [])); }, []);
  const set = (key: keyof CouponForm, value: CouponForm[keyof CouponForm]) => setForm((current) => ({ ...current, [key]: value }));
  const openCreate = () => { setEditing(null); setForm(blankForm()); setOpen(true); };
  const openEdit = (coupon: Coupon) => { if (coupon.redemption_count > 0) return; setEditing(coupon); setForm({ name: coupon.name, type: coupon.type, value: coupon.value, planCode: coupon.plan_code ?? "", validFrom: formatDate(coupon.valid_from), validUntil: formatDate(coupon.valid_until), distributionType: coupon.distribution_type, customCode: coupon.code, maxRedemptions: coupon.max_redemptions?.toString() ?? "" }); setOpen(true); };
  const closeForm = () => { setOpen(false); setEditing(null); };
  const save = async () => {
    setError("");
    const common = { name: form.name, type: form.type, value: form.value, planCode: form.type === "FREE_MONTHS" ? form.planCode : null, validFrom: new Date(`${form.validFrom}T00:00:00+09:00`).toISOString(), validUntil: new Date(`${form.validUntil}T23:59:59+09:00`).toISOString() };
    const body = editing ? common : { ...form, ...common, maxRedemptions: form.maxRedemptions || null };
    const response = await fetch(editing ? `${API}/admin/coupons/${editing.id}` : `${API}/admin/coupons`, { method: editing ? "PATCH" : "POST", headers, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) { setError(data.error === "DUPLICATE_CODE" ? "이미 사용 중인 쿠폰번호입니다." : data.message || "입력 내용을 확인해 주세요."); return; }
    closeForm(); await load();
  };
  const remove = async (coupon: Coupon) => { if (confirm(`${coupon.code} 쿠폰을 삭제하시겠습니까?`)) { await fetch(`${API}/admin/coupons/${coupon.id}`, { method: "DELETE", headers }); await load(); } };
  const toggle = async (coupon: Coupon) => { await fetch(`${API}/admin/coupons/${coupon.id}`, { method: "PATCH", headers, body: JSON.stringify({ isActive: !coupon.is_active }) }); await load(); };
  const benefit = (coupon: Coupon) => coupon.type === "FREE_MONTHS" ? `${plans.find((plan) => plan.code === coupon.plan_code)?.name ?? coupon.plan_code} ${coupon.value}개월 무료` : coupon.type === "PERCENT_DISCOUNT" ? `전체 구독 요금제 ${coupon.value}% 할인` : `${TYPES[coupon.type]} · ${coupon.value}회`;

  return <Box sx={{ p: 3 }}>
    <Stack direction="row" justifyContent="space-between" mb={2}><Box><Typography fontSize={20} fontWeight={900}>쿠폰 관리</Typography><Typography fontSize={13} color="text.secondary">1회용 쿠폰과 SNS 공개용 오픈 쿠폰을 관리합니다.</Typography></Box><Button variant="contained" onClick={openCreate}>쿠폰 생성</Button></Stack>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    <TextField fullWidth size="small" placeholder="쿠폰번호, 쿠폰명, 이메일 검색" value={search} onChange={(event) => setSearch(event.target.value)} sx={{ mb: 2 }} />
    <Table size="small"><TableHead><TableRow><TableCell>쿠폰번호</TableCell><TableCell>발급</TableCell><TableCell>혜택</TableCell><TableCell>사용기한</TableCell><TableCell>상태 / 사용</TableCell><TableCell>관리</TableCell></TableRow></TableHead><TableBody>{rows.map((coupon) => <TableRow key={coupon.id}>
      <TableCell><b>{coupon.code}</b><br />{coupon.name}</TableCell><TableCell><Chip size="small" label={coupon.distribution_type === "OPEN" ? "오픈" : "1회용"} /></TableCell><TableCell>{benefit(coupon)}</TableCell><TableCell>{formatDate(coupon.valid_from)} ~ {formatDate(coupon.valid_until)}</TableCell>
      <TableCell><Chip size="small" color={coupon.is_active ? "success" : "error"} label={coupon.is_active ? "사용 가능" : "중지"} /><Button size="small" onClick={() => setDetail(coupon)}>{coupon.redemption_count}명{coupon.max_redemptions ? `/${coupon.max_redemptions}명` : ""}</Button></TableCell>
      <TableCell><Switch size="small" checked={coupon.is_active} onChange={() => toggle(coupon)} /><Button size="small" disabled={coupon.redemption_count > 0} onClick={() => openEdit(coupon)}>수정</Button><Button color="error" size="small" onClick={() => remove(coupon)}>삭제</Button></TableCell>
    </TableRow>)}</TableBody></Table>
    <Dialog open={open} onClose={closeForm} fullWidth maxWidth="sm"><DialogTitle>{editing ? "쿠폰 수정" : "쿠폰 생성"}</DialogTitle><DialogContent><Stack gap={2} mt={1}>
      <TextField select label="발급 방식" value={form.distributionType} disabled={!!editing} onChange={(event) => set("distributionType", event.target.value)}><MenuItem value="SINGLE">1회용 난수 쿠폰</MenuItem><MenuItem value="OPEN">SNS 공개용 오픈 쿠폰</MenuItem></TextField>
      {editing && <TextField label="쿠폰번호" value={editing.code} disabled />}
      {form.distributionType === "OPEN" && !editing && <><TextField label="공개 쿠폰번호" value={form.customCode} onChange={(event) => set("customCode", event.target.value)} helperText="한글·영문·숫자 사용 가능" /><TextField type="number" label="전체 사용 한도 (비우면 무제한)" value={form.maxRedemptions} onChange={(event) => set("maxRedemptions", event.target.value)} /></>}
      {form.distributionType === "OPEN" && editing && <TextField label="전체 사용 한도" value={form.maxRedemptions || "무제한"} disabled />}
      <TextField label="쿠폰명" value={form.name} onChange={(event) => set("name", event.target.value)} /><TextField select label="쿠폰 종류" value={form.type} onChange={(event) => set("type", event.target.value)}>{Object.entries(TYPES).map(([value, label]) => <MenuItem value={value} key={value}>{label}</MenuItem>)}</TextField>
      {form.type === "FREE_MONTHS" && <><TextField select label="적용 요금제" value={form.planCode} onChange={(event) => set("planCode", event.target.value)}><MenuItem value="" disabled>요금제를 선택하세요</MenuItem>{plans.map((plan) => <MenuItem key={plan.code} value={plan.code}>{plan.name}</MenuItem>)}</TextField><TextField type="number" label="무료 이용 개월 수" value={form.value} onChange={(event) => set("value", Number(event.target.value))} /></>}
      {form.type === "PERCENT_DISCOUNT" && <TextField type="number" label="할인율 (%)" value={form.value} onChange={(event) => set("value", Number(event.target.value))} />}
      {!['FREE_MONTHS', 'PERCENT_DISCOUNT'].includes(form.type) && <TextField type="number" label="지급 횟수" value={form.value} onChange={(event) => set("value", Number(event.target.value))} />}
      <Stack direction="row" gap={1}><TextField fullWidth type="date" label="시작일" InputLabelProps={{ shrink: true }} value={form.validFrom} onChange={(event) => set("validFrom", event.target.value)} /><TextField fullWidth type="date" label="종료일" InputLabelProps={{ shrink: true }} value={form.validUntil} onChange={(event) => set("validUntil", event.target.value)} /></Stack>
    </Stack></DialogContent><DialogActions><Button onClick={closeForm}>취소</Button><Button variant="contained" onClick={save}>저장</Button></DialogActions></Dialog>
    <Dialog open={!!detail} onClose={() => setDetail(null)} fullWidth><DialogTitle>사용 내역</DialogTitle><DialogContent>{detail?.redemptions.map((use) => <Box key={use.id} py={1}><b>{use.name}</b> · {use.email}<br /><small>{new Date(use.redeemed_at).toLocaleString()}</small>{use.clubs.map((club) => <Chip key={club.id} size="small" label={`클럽장 · ${club.name}`} />)}</Box>)}</DialogContent></Dialog>
  </Box>;
}
