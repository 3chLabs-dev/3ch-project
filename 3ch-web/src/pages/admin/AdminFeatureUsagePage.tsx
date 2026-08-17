import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Pagination,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

const API = import.meta.env.VITE_API_BASE_URL ?? "/api";
const FEATURES = [
  { value: "CLUB_CREATE", label: "클럽 생성" },
  { value: "CLUB_JOIN", label: "클럽 가입" },
  { value: "LEAGUE_CREATE", label: "리그 생성" },
  { value: "TOURNAMENT_CREATE", label: "대회 생성" },
  { value: "EVENT_JOIN", label: "리그·대회 참가" },
  { value: "VISION_SCAN", label: "클럽회원·참가자·대진표 사진 인식" },
  { value: "DRAW_CREATE", label: "추첨 생성" },
  { value: "PREMIUM_PROMOTION", label: "프리미엄 노출" },
];
const ACTION_LABEL: Record<string, string> = {
  CONSUME: "차감",
  REFUND: "환불",
  GRANT: "지급",
  REVOKE: "회수",
};
const SOURCE_LABEL: Record<string, string> = {
  PLAN: "요금제",
  MANAGER_GRANT: "매니저 지급",
  MANUAL: "수동 지급",
};

type CreditBucket = {
  id: string;
  user_id: number;
  feature: string;
  source: string;
  initial_amount: number | null;
  remaining_amount: number | null;
  starts_at: string;
  expires_at: string | null;
  created_at: string;
  name: string;
  email: string;
  system_role: string;
  granted_by_name: string | null;
};

type UsageEvent = {
  id: string;
  user_id: number;
  feature: string;
  action: string;
  amount: number;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
  name: string;
  email: string;
  system_role: string;
  bucket_source: string | null;
};

type MonthlySummary = {
  feature: string;
  consumed: number;
  refunded: number;
  net_used: number;
};

type Member = {
  id: number;
  name: string;
  email: string;
  member_code: string;
  system_role: string;
};

const featureLabel = (feature: string) =>
  FEATURES.find((item) => item.value === feature)?.label ?? feature;
const dateTime = (value: string | null) =>
  value ? new Date(value).toLocaleString("ko-KR") : "만료 없음";
const dateInput = () => {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return date.toISOString().slice(0, 10);
};

export default function AdminFeatureUsagePage() {
  const token = localStorage.getItem("admin_token") ?? "";
  const headers = useMemo(
    () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token}` }),
    [token],
  );
  const [buckets, setBuckets] = useState<CreditBucket[]>([]);
  const [events, setEvents] = useState<UsageEvent[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [feature, setFeature] = useState("");
  const [action, setAction] = useState("");
  const [error, setError] = useState("");
  const [grantOpen, setGrantOpen] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [grantFeature, setGrantFeature] = useState("VISION_SCAN");
  const [grantAmount, setGrantAmount] = useState(1);
  const [expiresAt, setExpiresAt] = useState(dateInput());
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(page),
      limit: "20",
      search: appliedSearch,
      feature,
      action,
    });
    const response = await fetch(`${API}/admin/feature-usage?${params}`, { headers });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error === "MASTER_REQUIRED" ? "마스터만 사용할 수 있습니다." : "사용량 정보를 불러오지 못했습니다.");
      return;
    }
    setBuckets(data.buckets ?? []);
    setEvents(data.events ?? []);
    setMonthlySummary(data.monthly_summary ?? []);
    setTotal(data.total ?? 0);
    setError("");
  }, [action, appliedSearch, feature, headers, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const findMembers = async () => {
    const query = memberQuery.trim();
    if (!query) return;
    const params = new URLSearchParams({ page: "1", limit: "20" });
    params.set(query.includes("@") ? "email" : "name", query);
    const response = await fetch(`${API}/admin/members?${params}`, { headers });
    const data = await response.json();
    if (response.ok) setMembers(data.members ?? []);
  };

  const grant = async () => {
    if (!selectedMember || grantAmount < 1 || !expiresAt) return;
    setSaving(true);
    const response = await fetch(
      `${API}/admin/members/${selectedMember.id}/feature-adjustments`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          feature: grantFeature,
          amount: grantAmount,
          expires_at: new Date(`${expiresAt}T23:59:59+09:00`).toISOString(),
          reason,
        }),
      },
    );
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setError(data.error === "MASTER_UNLIMITED" ? "마스터 계정은 모든 기능이 무제한입니다." : "횟수를 지급하지 못했습니다.");
      return;
    }
    setGrantOpen(false);
    setSelectedMember(null);
    setMemberQuery("");
    setMembers([]);
    setReason("");
    await load();
  };

  const revoke = async (bucket: CreditBucket) => {
    const message = `${bucket.name} 회원의 ${featureLabel(bucket.feature)} 잔여 ${bucket.remaining_amount}회를 회수하시겠습니까?`;
    if (!window.confirm(message)) return;
    const revokeReason = window.prompt("회수 사유를 입력해 주세요.", "오지급 회수");
    if (revokeReason === null) return;
    const response = await fetch(`${API}/admin/feature-credit-buckets/${bucket.id}/revoke`, {
      method: "POST",
      headers,
      body: JSON.stringify({ reason: revokeReason }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error === "UNLIMITED_BUCKET" ? "무제한 지급 건은 회수할 수 없습니다." : "잔여 횟수를 회수하지 못했습니다.");
      return;
    }
    await load();
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Box>
          <Typography fontSize={18} fontWeight={900}>사용량 관리</Typography>
          <Typography fontSize={12} color="text.secondary" sx={{ mt: 0.5 }}>
            기능별 잔여 횟수와 차감·환불 이력을 확인하고 수동 지급을 관리합니다.
          </Typography>
        </Box>
        <Button variant="contained" disableElevation onClick={() => setGrantOpen(true)} sx={{ fontWeight: 800 }}>
          잔여 횟수 지급
        </Button>
      </Stack>

      <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ mb: 2 }}>
        <TextField
          size="small"
          label="이름 또는 이메일"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              setPage(1);
              setAppliedSearch(search.trim());
            }
          }}
          sx={{ minWidth: 240 }}
        />
        <TextField select size="small" label="기능" value={feature} onChange={(event) => { setPage(1); setFeature(event.target.value); }} sx={{ minWidth: 170 }}>
          <MenuItem value="">전체</MenuItem>
          {FEATURES.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="처리" value={action} onChange={(event) => { setPage(1); setAction(event.target.value); }} sx={{ minWidth: 130 }}>
          <MenuItem value="">전체</MenuItem>
          {Object.entries(ACTION_LABEL).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
        </TextField>
        <Button variant="outlined" onClick={() => { setPage(1); setAppliedSearch(search.trim()); }}>검색</Button>
      </Stack>

      {error && <Typography color="error" fontSize={13} sx={{ mb: 1.5 }}>{error}</Typography>}

      <Typography fontSize={15} fontWeight={900} sx={{ mb: 1 }}>이번 달 사용량</Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
          gap: 1.25,
          mb: 3,
        }}
      >
        {FEATURES.map((item) => {
          const summary = monthlySummary.find((row) => row.feature === item.value);
          return (
            <Box key={item.value} sx={{ border: "1px solid #E5E7EB", borderRadius: 1.5, p: 2, bgcolor: "#fff" }}>
              <Typography fontSize={13} color="text.secondary" fontWeight={700}>{item.label}</Typography>
              <Typography fontSize={26} fontWeight={900} sx={{ mt: 0.5 }}>
                {summary?.net_used ?? 0}
                <Typography component="span" fontSize={13} color="text.secondary" sx={{ ml: 0.5 }}>회</Typography>
              </Typography>
              <Typography fontSize={11} color="text.secondary" sx={{ mt: 0.5 }}>
                차감 {summary?.consumed ?? 0}회 · 환불 {summary?.refunded ?? 0}회
              </Typography>
            </Box>
          );
        })}
      </Box>

      <Typography fontSize={15} fontWeight={900} sx={{ mb: 1 }}>활성 잔여 횟수</Typography>
      <Box sx={{ border: "1px solid #E5E7EB", borderRadius: 1.5, overflowX: "auto", mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "#F9FAFB" }}>
              {["회원", "기능", "지급 구분", "지급", "잔여", "만료일", "지급자", "관리"].map((label) =>
                <TableCell key={label} sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>{label}</TableCell>)}
            </TableRow>
          </TableHead>
          <TableBody>
            {buckets.length === 0 && <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4, color: "text.secondary" }}>활성 잔여 횟수가 없습니다.</TableCell></TableRow>}
            {buckets.map((bucket) => (
              <TableRow key={bucket.id} hover>
                <TableCell><b>{bucket.name}</b><Typography fontSize={11} color="text.secondary">{bucket.email}</Typography></TableCell>
                <TableCell>{featureLabel(bucket.feature)}</TableCell>
                <TableCell>{SOURCE_LABEL[bucket.source] ?? bucket.source}</TableCell>
                <TableCell>{bucket.initial_amount == null ? "무제한" : `${bucket.initial_amount}회`}</TableCell>
                <TableCell><b>{bucket.remaining_amount == null ? "무제한" : `${bucket.remaining_amount}회`}</b></TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>{dateTime(bucket.expires_at)}</TableCell>
                <TableCell>{bucket.granted_by_name ?? "-"}</TableCell>
                <TableCell>
                  {bucket.remaining_amount != null && (
                    <Button size="small" color="error" onClick={() => void revoke(bucket)}>회수</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>

      <Typography fontSize={15} fontWeight={900} sx={{ mb: 1 }}>사용 이력</Typography>
      <Box sx={{ border: "1px solid #E5E7EB", borderRadius: 1.5, overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "#F9FAFB" }}>
              {["일시", "회원", "기능", "처리", "횟수", "연결 대상"].map((label) =>
                <TableCell key={label} sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>{label}</TableCell>)}
            </TableRow>
          </TableHead>
          <TableBody>
            {events.length === 0 && <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: "text.secondary" }}>사용 이력이 없습니다.</TableCell></TableRow>}
            {events.map((event) => (
              <TableRow key={event.id} hover>
                <TableCell sx={{ whiteSpace: "nowrap" }}>{dateTime(event.created_at)}</TableCell>
                <TableCell><b>{event.name}</b><Typography fontSize={11} color="text.secondary">{event.email}</Typography></TableCell>
                <TableCell>{featureLabel(event.feature)}</TableCell>
                <TableCell>{ACTION_LABEL[event.action] ?? event.action}</TableCell>
                <TableCell>{event.amount}회</TableCell>
                <TableCell>{event.reference_type ? `${event.reference_type} · ${event.reference_id ?? "-"}` : "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      {total > 20 && (
        <Stack alignItems="center" sx={{ mt: 2 }}>
          <Pagination count={Math.ceil(total / 20)} page={page} onChange={(_, value) => setPage(value)} color="primary" />
        </Stack>
      )}

      <Dialog open={grantOpen} onClose={() => setGrantOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 900 }}>
          잔여 횟수 지급
          <IconButton onClick={() => setGrantOpen(false)} sx={{ position: "absolute", right: 12, top: 10 }}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                label="회원 이름 또는 이메일"
                value={memberQuery}
                onChange={(event) => setMemberQuery(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") void findMembers(); }}
                fullWidth
              />
              <Button variant="outlined" onClick={() => void findMembers()}>검색</Button>
            </Stack>
            {members.length > 0 && (
              <Box sx={{ border: "1px solid #E5E7EB", borderRadius: 1, maxHeight: 180, overflowY: "auto" }}>
                {members.map((member) => (
                  <Box
                    key={member.id}
                    onClick={() => setSelectedMember(member)}
                    sx={{
                      px: 1.5, py: 1, cursor: "pointer",
                      bgcolor: selectedMember?.id === member.id ? "#EFF6FF" : "#fff",
                      borderBottom: "1px solid #F3F4F6",
                    }}
                  >
                    <Typography fontSize={13} fontWeight={800}>{member.name} <Typography component="span" fontSize={11} color="text.secondary">({member.system_role})</Typography></Typography>
                    <Typography fontSize={11} color="text.secondary">{member.email}</Typography>
                  </Box>
                ))}
              </Box>
            )}
            {selectedMember && <Typography fontSize={13} color="primary" fontWeight={800}>선택: {selectedMember.name} ({selectedMember.email})</Typography>}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField select label="기능" value={grantFeature} onChange={(event) => setGrantFeature(event.target.value)} fullWidth>
                {FEATURES.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
              </TextField>
              <TextField label="지급 횟수" type="number" value={grantAmount} onChange={(event) => setGrantAmount(Math.max(1, Number(event.target.value) || 1))} inputProps={{ min: 1, max: 100000 }} fullWidth />
            </Stack>
            <TextField label="만료일" type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
            <TextField label="지급 사유" value={reason} onChange={(event) => setReason(event.target.value)} inputProps={{ maxLength: 200 }} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setGrantOpen(false)}>취소</Button>
          <Button variant="contained" disableElevation disabled={!selectedMember || saving} onClick={() => void grant()}>
            {saving ? "지급 중" : "지급"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
