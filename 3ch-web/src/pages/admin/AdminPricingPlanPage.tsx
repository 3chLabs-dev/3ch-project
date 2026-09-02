import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  FormControl, FormControlLabel, IconButton, MenuItem, Radio, RadioGroup, Stack,
  Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

const API = import.meta.env.VITE_API_BASE_URL ?? "/api";
const FEATURE_OPTIONS = [
  { key: "club_create", label: "클럽 생성" },
  { key: "club_join", label: "클럽 가입" },
  { key: "league_create", label: "리그 생성" },
  { key: "tournament_create", label: "대회 생성" },
  { key: "event_join", label: "리그·대회 참가" },
  { key: "vision_scan", label: "클럽회원·참가자·대진표 사진 인식" },
  { key: "ranking_season_create", label: "시즌 생성" },
  { key: "draw_create", label: "추첨 생성" },
  { key: "premium_promotion", label: "프리미엄 노출" },
] as const;
type FeatureKey = typeof FEATURE_OPTIONS[number]["key"];
type FeatureLimits = Record<FeatureKey, number | null>;
const DEFAULT_FEATURE_LIMITS: FeatureLimits = {
  club_create: null,
  club_join: null,
  league_create: 1,
  tournament_create: 0,
  event_join: null,
  vision_scan: 0,
  ranking_season_create: 1,
  draw_create: 1,
  premium_promotion: 0,
};
type Plan = {
  id: number; code: string; name: string; badge_text: string | null; price: number;
  original_price: number | null; billing_cycle: "MONTHLY" | "YEARLY";
  sale_start_at: string | null; sale_end_at: string | null; features: string[];
  feature_limits: FeatureLimits;
  display_order: number; is_visible: boolean; created_at: string;
};
type Form = Omit<Plan, "id" | "created_at" | "features"> & { featuresText: string };
const EMPTY: Form = {
  code: "", name: "", badge_text: "", price: 0, original_price: null,
  billing_cycle: "MONTHLY", sale_start_at: null, sale_end_at: null,
  feature_limits: { ...DEFAULT_FEATURE_LIMITS },
  featuresText: "", display_order: 0, is_visible: true,
};
const dateValue = (value: string | null) => value ? value.slice(0, 10) : "";
const datePayload = (value: string) => value ? new Date(value + "T00:00:00+09:00").toISOString() : null;
const won = (value: number | null) => value == null ? "-" : value.toLocaleString("ko-KR") + "원";

export default function AdminPricingPlanPage() {
  const token = localStorage.getItem("admin_token") ?? "";
  const headers = useMemo(() => ({ "Content-Type": "application/json", Authorization: `Bearer ${token}` }), [token]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`${API}/admin/pricing-plans`, {
      headers,
      cache: "no-store",
    });
    const data = await response.json();
    if (response.ok) setPlans(data.plans ?? []);
    else setError("요금제 목록을 불러오지 못했습니다.");
  }, [headers]);
  useEffect(() => { void load(); }, [load]);

  const openCreate = () => { setEditId(null); setForm(EMPTY); setError(""); setOpen(true); };
  const openEdit = (plan: Plan) => {
    setEditId(plan.id);
    setForm({
      code: plan.code, name: plan.name, badge_text: plan.badge_text ?? "",
      price: plan.price, original_price: plan.original_price,
      billing_cycle: plan.billing_cycle, sale_start_at: plan.sale_start_at,
      sale_end_at: plan.sale_end_at, featuresText: (plan.features ?? []).join("\n"),
      feature_limits: {
        ...DEFAULT_FEATURE_LIMITS,
        ...(plan.code.toLowerCase() === "premium" && plan.feature_limits?.premium_promotion === undefined
          ? { premium_promotion: null }
          : {}),
        ...(plan.feature_limits ?? {}),
      },
      display_order: plan.display_order, is_visible: plan.is_visible,
    });
    setError(""); setOpen(true);
  };
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((prev) => ({ ...prev, [key]: value }));
  const setFeatureLimit = (key: FeatureKey, value: number | null) => {
    setForm((prev) => ({
      ...prev,
      feature_limits: { ...prev.feature_limits, [key]: value },
    }));
  };

  const save = async () => {
    if (!form.code.trim() || !form.name.trim()) { setError("요금제 코드와 상품명을 입력해 주세요."); return; }
    setSaving(true); setError("");
    const body = {
      code: form.code,
      name: form.name,
      badge_text: form.badge_text?.trim() || null,
      price: Number(form.price),
      original_price: form.original_price === null || Number.isNaN(form.original_price) ? null : Number(form.original_price),
      billing_cycle: form.billing_cycle,
      sale_start_at: datePayload(dateValue(form.sale_start_at)),
      sale_end_at: datePayload(dateValue(form.sale_end_at)),
      features: form.featuresText.split("\n").map((v) => v.trim()).filter(Boolean),
      feature_limits: form.feature_limits,
      display_order: form.display_order,
      is_visible: form.is_visible,
    };
    const response = await fetch(`${API}/admin/pricing-plans${editId ? "/" + editId : ""}`, {
      method: editId ? "PUT" : "POST", headers, body: JSON.stringify(body),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setError(data.error === "MASTER_REQUIRED" ? "마스터만 요금제를 변경할 수 있습니다." : "저장하지 못했습니다.");
      return;
    }
    if (data.plan) {
      setPlans((previous) => {
        const savedPlan = data.plan as Plan;
        const exists = previous.some((plan) => plan.id === savedPlan.id);
        const next = exists
          ? previous.map((plan) => plan.id === savedPlan.id ? savedPlan : plan)
          : [...previous, savedPlan];
        return next.sort((a, b) => a.display_order - b.display_order || a.id - b.id);
      });
    }
    setOpen(false);
    await load();
  };
  const remove = async (plan: Plan) => {
    if (!window.confirm(`${plan.name} 요금제를 삭제하시겠습니까?`)) return;
    const response = await fetch(`${API}/admin/pricing-plans/${plan.id}`, { method: "DELETE", headers });
    if (!response.ok) { setError("마스터만 요금제를 삭제할 수 있습니다."); return; }
    await load();
  };

  return <Box sx={{ p: 3 }}>
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
      <Box>
        <Typography fontSize={18} fontWeight={900}>요금제 관리</Typography>
        <Typography fontSize={12} color="text.secondary" sx={{ mt: 0.5 }}>판매 가격, 기간, 노출 문구를 관리합니다.</Typography>
      </Box>
      <Button variant="contained" disableElevation onClick={openCreate} sx={{ fontWeight: 800 }}>신규 추가</Button>
    </Stack>
    {error && <Typography color="error" fontSize={13} sx={{ mb: 1 }}>{error}</Typography>}
    <Box sx={{ border: "1px solid #E5E7EB", borderRadius: 1.5, overflowX: "auto" }}>
      <Table size="small">
        <TableHead><TableRow sx={{ bgcolor: "#F9FAFB" }}>
          {["No.", "순서", "상품", "금액", "결제주기", "적용기간", "생성일시", "공개", "관리"].map((label) =>
            <TableCell key={label} sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>{label}</TableCell>)}
        </TableRow></TableHead>
        <TableBody>
          {plans.map((plan, index) => <TableRow key={plan.id} hover>
            <TableCell>{index + 1}</TableCell><TableCell>{plan.display_order}</TableCell>
            <TableCell><b>{plan.name}</b><Typography fontSize={11} color="text.secondary">{plan.code}</Typography></TableCell>
            <TableCell>{won(plan.price)}{plan.original_price != null && <Typography fontSize={11} color="text.secondary" sx={{ textDecoration: "line-through" }}>{won(plan.original_price)}</Typography>}</TableCell>
            <TableCell>{plan.billing_cycle === "YEARLY" ? "연" : "월"}</TableCell>
            <TableCell sx={{ whiteSpace: "nowrap" }}>{dateValue(plan.sale_start_at) || "상시"} ~ {dateValue(plan.sale_end_at) || "상시"}</TableCell>
            <TableCell sx={{ whiteSpace: "nowrap" }}>{dateValue(plan.created_at)}</TableCell>
            <TableCell>{plan.is_visible ? "공개" : "비공개"}</TableCell>
            <TableCell sx={{ whiteSpace: "nowrap" }}>
              <Button size="small" onClick={() => openEdit(plan)}>수정</Button>
              <Button size="small" color="error" onClick={() => void remove(plan)}>삭제</Button>
            </TableCell>
          </TableRow>)}
        </TableBody>
      </Table>
    </Box>

    <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 900 }}>{editId ? "요금제 수정" : "요금제 추가"}
        <IconButton onClick={() => setOpen(false)} sx={{ position: "absolute", right: 12, top: 10 }}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.2} sx={{ pt: 0.5 }}>
          {error && <Typography color="error" fontSize={13}>{error}</Typography>}
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField label="요금제 코드" value={form.code} onChange={(e) => set("code", e.target.value)} fullWidth helperText="basic, pro처럼 영문 소문자로 입력" />
            <TextField label="상품명" value={form.name} onChange={(e) => set("name", e.target.value)} fullWidth />
            <TextField label="배지 문구" value={form.badge_text ?? ""} onChange={(e) => set("badge_text", e.target.value)} fullWidth placeholder="인기, 50% 할인" />
          </Stack>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField label="실제 결제금액" type="number" value={form.price} onChange={(e) => set("price", Number(e.target.value))} fullWidth inputProps={{ min: 0 }} />
            <TextField label="정가" type="number" value={form.original_price ?? ""} onChange={(e) => set("original_price", e.target.value === "" ? null : Number(e.target.value))} fullWidth inputProps={{ min: 0 }} />
            <TextField select label="결제주기" value={form.billing_cycle} onChange={(e) => set("billing_cycle", e.target.value as Form["billing_cycle"])} fullWidth>
              <MenuItem value="MONTHLY">월</MenuItem><MenuItem value="YEARLY">연</MenuItem>
            </TextField>
          </Stack>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField label="적용 시작일" type="date" value={dateValue(form.sale_start_at)} onChange={(e) => set("sale_start_at", e.target.value || null)} InputLabelProps={{ shrink: true }} fullWidth />
            <TextField label="적용 종료일" type="date" value={dateValue(form.sale_end_at)} onChange={(e) => set("sale_end_at", e.target.value || null)} InputLabelProps={{ shrink: true }} fullWidth />
            <TextField label="노출 순서" type="number" value={form.display_order} onChange={(e) => set("display_order", Number(e.target.value))} fullWidth inputProps={{ min: 0, max: 9999 }} />
          </Stack>
          <Divider />
          <Box>
            <Typography fontWeight={900} sx={{ mb: 0.5 }}>기능</Typography>
            <Typography fontSize={12} color="text.secondary" sx={{ mb: 1.5 }}>
              기능별 월 제공 횟수, 무제한 또는 제공하지 않음을 설정합니다. 없음으로 설정한 기능은 요금제에 노출되지 않습니다.
            </Typography>
            <Stack spacing={0.8}>
              {FEATURE_OPTIONS.map(({ key, label }) => {
                const limit = form.feature_limits[key];
                return (
                  <Box
                    key={key}
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", sm: "minmax(260px, 1fr) auto" },
                      alignItems: "center",
                      minHeight: 48,
                      px: 1.5,
                      py: 0.5,
                      border: "1px solid #E5E7EB",
                      borderRadius: 1,
                    }}
                  >
                    <Typography fontSize={14} fontWeight={800} sx={{ whiteSpace: "nowrap", pr: 2 }}>{label}</Typography>
                    <FormControl sx={{ justifySelf: { sm: "end" } }}>
                      <RadioGroup
                        row
                        value={limit === null ? "unlimited" : limit === 0 ? "none" : "monthly"}
                        onChange={(event) => {
                          const mode = event.target.value;
                          setFeatureLimit(key, mode === "unlimited" ? null : mode === "none" ? 0 : (limit && limit > 0 ? limit : 1));
                        }}
                        sx={{ flexWrap: "nowrap", alignItems: "center", gap: 1 }}
                      >
                        <FormControlLabel
                          value="monthly"
                          control={<Radio size="small" />}
                          label={(
                            <Stack direction="row" alignItems="center" spacing={0.8}>
                              <Typography fontSize={13}>월</Typography>
                              <TextField
                                value={typeof limit === "number" && limit > 0 ? limit : 1}
                                type="number"
                                size="small"
                                disabled={limit === null || limit === 0}
                                onClick={(event) => event.stopPropagation()}
                                onChange={(event) => {
                                  const value = Math.min(100000, Math.max(1, Number.parseInt(event.target.value || "1", 10) || 1));
                                  setFeatureLimit(key, value);
                                }}
                                inputProps={{ min: 1, max: 100000, style: { textAlign: "center" } }}
                                sx={{ width: 82 }}
                              />
                              <Typography fontSize={13}>회</Typography>
                            </Stack>
                          )}
                          sx={{ mr: 1 }}
                        />
                        <FormControlLabel
                          value="unlimited"
                          control={<Radio size="small" />}
                          label={<Typography fontSize={13}>무제한</Typography>}
                        />
                        <FormControlLabel
                          value="none"
                          control={<Radio size="small" />}
                          label={<Typography fontSize={13}>없음</Typography>}
                        />
                      </RadioGroup>
                    </FormControl>
                  </Box>
                );
              })}
            </Stack>
          </Box>
          <TextField
            label="기타"
            value={form.featuresText}
            onChange={(e) => set("featuresText", e.target.value)}
            multiline
            minRows={4}
            fullWidth
            placeholder="기타 안내할 혜택을 입력해 주세요."
            helperText="한 줄에 한 항목씩 입력하면 요금제 페이지에 표시됩니다."
          />
          <FormControlLabel control={<Switch checked={form.is_visible} onChange={(e) => set("is_visible", e.target.checked)} />} label="요금제 페이지에 공개" />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={() => setOpen(false)}>취소</Button>
        <Button variant="contained" disableElevation onClick={() => void save()} disabled={saving}>{saving ? "저장 중" : editId ? "수정" : "등록"}</Button>
      </DialogActions>
    </Dialog>
  </Box>;
}
