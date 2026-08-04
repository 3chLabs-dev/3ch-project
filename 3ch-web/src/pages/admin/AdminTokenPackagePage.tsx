import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

const API = import.meta.env.VITE_API_BASE_URL ?? "/api";
const FEATURE_FIELDS = [
  ["club_create", "클럽 생성"],
  ["club_join", "클럽 가입"],
  ["league_create", "리그 생성"],
  ["tournament_create", "대회 생성"],
  ["event_join", "리그·대회 참가"],
  ["vision_scan", "참가자·대진표 사진 인식"],
  ["draw_create", "추첨 생성"],
] as const;

type TokenPackage = {
  id: number;
  code: string;
  name: string;
  price: number;
  credits: Record<string, number>;
  display_order: number;
  is_visible: boolean;
};

const emptyPackage: Omit<TokenPackage, "id"> = {
  code: "",
  name: "",
  price: 0,
  credits: {},
  display_order: 1,
  is_visible: true,
};

function getSaveErrorMessage(data: {
  error?: string;
  message?: string;
  details?: { fieldErrors?: Record<string, string[]> };
}) {
  if (data.message) return data.message;
  if (data.error === "MASTER_REQUIRED") return "마스터 계정만 토큰 상품을 저장할 수 있습니다.";
  if (data.error === "DUPLICATE_PACKAGE_CODE") return "이미 사용 중인 상품 코드입니다.";
  if (data.error === "VALIDATION_ERROR") {
    const fieldErrors = data.details?.fieldErrors ?? {};
    if (fieldErrors.name?.length) return "상품명을 입력해 주세요.";
    if (fieldErrors.price?.length) return "판매 가격은 1원 이상으로 입력해 주세요.";
    return "상품 입력값을 확인해 주세요.";
  }
  if (data.error === "DB_ERROR") {
    return "토큰 상품 DB가 준비되지 않았습니다. API 마이그레이션 적용 여부를 확인해 주세요.";
  }
  return "토큰 상품을 저장하지 못했습니다.";
}

export default function AdminTokenPackagePage() {
  const [packages, setPackages] = useState<TokenPackage[]>([]);
  const [editing, setEditing] = useState<TokenPackage | Omit<TokenPackage, "id"> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const adminToken = localStorage.getItem("admin_token");
  const headers = useMemo(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${adminToken ?? ""}`,
  }), [adminToken]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API}/admin/token-packages`, { headers });
      if (!response.ok) throw new Error("토큰 상품을 불러오지 못했습니다.");
      const data = await response.json();
      setPackages(data.packages ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "토큰 상품을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async () => {
    if (!editing) return;
    setLoading(true);
    setError("");
    try {
      const hasId = "id" in editing;
      const response = await fetch(
        `${API}/admin/token-packages${hasId ? `/${editing.id}` : ""}`,
        { method: hasId ? "PUT" : "POST", headers, body: JSON.stringify(editing) },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(getSaveErrorMessage(data));
      setEditing(null);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "토큰 상품을 저장하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const hide = async (id: number) => {
    if (!window.confirm("이 상품을 요금제 페이지에서 숨기시겠습니까?")) return;
    setLoading(true);
    try {
      const response = await fetch(`${API}/admin/token-packages/${id}`, { method: "DELETE", headers });
      if (!response.ok) throw new Error("상품을 숨기지 못했습니다.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "상품을 숨기지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h6" fontWeight={900}>토큰 상품</Typography>
          <Typography fontSize={13} color="text.secondary">
            사용자가 추가 구매할 기능 횟수와 가격을 설정합니다.
          </Typography>
        </Box>
        <Button variant="contained" onClick={() => setEditing({ ...emptyPackage })} disabled={loading}>
          신규 추가
        </Button>
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Stack spacing={1.5}>
        {packages.map((item) => (
          <Box key={item.id} sx={{ border: "1px solid #E5E7EB", borderRadius: 1.5, p: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography fontWeight={900}>{item.name}</Typography>
                <Typography fontSize={12} color="text.secondary">{item.code}</Typography>
              </Box>
              <Typography fontWeight={900}>{Number(item.price).toLocaleString("ko-KR")}원</Typography>
            </Stack>
            <Divider sx={{ my: 1.5 }} />
            <Stack direction="row" gap={1} flexWrap="wrap">
              {FEATURE_FIELDS.filter(([key]) => Number(item.credits?.[key] ?? 0) > 0).map(([key, label]) => (
                <Typography key={key} fontSize={12} sx={{ bgcolor: "#EFF6FF", color: "#2563EB", px: 1, py: 0.5, borderRadius: 1 }}>
                  {label} {item.credits[key]}회
                </Typography>
              ))}
            </Stack>
            <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 1.5 }}>
              <Button size="small" onClick={() => setEditing(item)}>수정</Button>
              {item.is_visible && <Button size="small" color="error" onClick={() => void hide(item.id)}>숨김</Button>}
            </Stack>
          </Box>
        ))}
        {!loading && packages.length === 0 && (
          <Typography color="text.secondary" textAlign="center" sx={{ py: 6 }}>등록된 토큰 상품이 없습니다.</Typography>
        )}
      </Stack>

      <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={900}>{editing && "id" in editing ? "토큰 상품 수정" : "토큰 상품 추가"}</DialogTitle>
        {editing && (
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Stack direction="row" spacing={1.5}>
                <TextField label="상품 코드" value={editing.code} fullWidth
                  onChange={(event) => setEditing({ ...editing, code: event.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })} />
                <TextField label="상품명" value={editing.name} fullWidth
                  onChange={(event) => setEditing({ ...editing, name: event.target.value })} />
              </Stack>
              <Stack direction="row" spacing={1.5}>
                <TextField label="판매 가격" type="number" value={editing.price} fullWidth inputProps={{ min: 1 }}
                  onChange={(event) => setEditing({ ...editing, price: Math.max(0, Number(event.target.value)) })} />
                <TextField label="노출 순서" type="number" value={editing.display_order} fullWidth
                  onChange={(event) => setEditing({ ...editing, display_order: Number(event.target.value) })} />
              </Stack>
              <Typography fontWeight={900}>지급 횟수</Typography>
              {FEATURE_FIELDS.map(([key, label]) => (
                <Stack key={key} direction="row" alignItems="center" justifyContent="space-between">
                  <Typography fontSize={14}>{label}</Typography>
                  <TextField
                    size="small"
                    type="number"
                    value={editing.credits?.[key] ?? 0}
                    inputProps={{ min: 0 }}
                    sx={{ width: 120 }}
                    onChange={(event) => setEditing({
                      ...editing,
                      credits: { ...editing.credits, [key]: Math.max(0, Number(event.target.value)) },
                    })}
                  />
                </Stack>
              ))}
              <FormControlLabel
                control={<Checkbox checked={editing.is_visible}
                  onChange={(event) => setEditing({ ...editing, is_visible: event.target.checked })} />}
                label="요금제 페이지에 공개"
              />
            </Stack>
          </DialogContent>
        )}
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setEditing(null)}>취소</Button>
          <Button variant="contained" onClick={() => void save()} disabled={loading}>저장</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
