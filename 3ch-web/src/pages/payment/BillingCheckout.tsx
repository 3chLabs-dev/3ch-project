import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import CreditCardOutlinedIcon from "@mui/icons-material/CreditCardOutlined";
import { loadTossPayments } from "@tosspayments/tosspayments-sdk";
import axios from "axios";
import { useSelector } from "react-redux";
import type { RootState } from "../../app/store";

const API = import.meta.env.VITE_API_BASE_URL ?? "/api";
const TOSS_CLIENT_KEY = import.meta.env.VITE_TOSS_CLIENT_KEY as string;

type Plan = {
  code: string;
  name: string;
  price: number;
};

export default function BillingCheckout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useSelector((state: RootState) => state.auth.user);
  const token = useSelector((state: RootState) => state.auth.token);
  const planCode = searchParams.get("plan") ?? "";
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const authHeaders = useMemo(
    () => ({ Authorization: `Bearer ${token}` }),
    [token],
  );

  useEffect(() => {
    if (!user || !token) {
      navigate("/login", { replace: true });
      return;
    }
    if (!planCode) {
      navigate("/mypage/pricing", { replace: true });
      return;
    }
    fetch(`${API}/payment/plans`)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => {
        const selected = (data.plans ?? []).find((item: Plan) => item.code === planCode);
        if (!selected || Number(selected.price) <= 0) throw new Error("INVALID_PLAN");
        setPlan(selected);
      })
      .catch(() => setError("요금제 정보를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [navigate, planCode, token, user]);

  const handleRegisterCard = async () => {
    if (!plan || !user || submitting) return;
    if (!TOSS_CLIENT_KEY) {
      setError("토스페이먼츠 클라이언트 키가 설정되지 않았습니다.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const keyResponse = await axios.get(
        `${API}/payment/billing/customer-key`,
        { headers: authHeaders },
      );
      const customerKey = keyResponse.data.customerKey as string;
      const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY);
      const payment = tossPayments.payment({ customerKey });
      const successUrl = new URL("/payment/billing/success", window.location.origin);
      successUrl.searchParams.set("plan", plan.code);
      sessionStorage.setItem("billing_plan_code", plan.code);

      await payment.requestBillingAuth({
        method: "CARD",
        successUrl: successUrl.toString(),
        failUrl: `${window.location.origin}/payment/billing/fail`,
        customerEmail: user.email,
        customerName: user.name ?? undefined,
      });
    } catch (requestError) {
      if (axios.isAxiosError(requestError)) {
        setError(requestError.response?.data?.message || "카드 등록을 시작하지 못했습니다.");
      } else {
        setError("카드 등록을 시작하지 못했습니다.");
      }
      setSubmitting(false);
    }
  };

  return (
    <Stack sx={{ width: "100%", maxWidth: 420, mx: "auto", mt: "-4px" }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <IconButton onClick={() => navigate(-1)} size="small" aria-label="뒤로가기">
          <ChevronLeftIcon />
        </IconButton>
        <Typography variant="h6" fontWeight={900}>자동결제 등록</Typography>
      </Stack>

      {loading ? (
        <Stack alignItems="center" sx={{ py: 8 }}>
          <CircularProgress size={30} />
        </Stack>
      ) : plan ? (
        <>
          <Box sx={{ border: "1px solid #E5E7EB", borderRadius: 2, p: 2.5, bgcolor: "#F9FAFB" }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <CreditCardOutlinedIcon color="primary" />
              <Box>
                <Typography fontWeight={900}>{plan.name}</Typography>
                <Typography color="text.secondary" fontSize={13}>매월 자동결제</Typography>
              </Box>
            </Stack>
            <Typography fontWeight={900} fontSize={24} sx={{ mt: 2 }}>
              월 {Number(plan.price).toLocaleString("ko-KR")}원
            </Typography>
          </Box>

          <Alert severity="info" sx={{ mt: 2, borderRadius: 1.5 }}>
            카드를 등록하면 첫 달 요금이 바로 결제되며, 이후 매월 같은 날짜에 자동결제됩니다.
          </Alert>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

          <Button
            fullWidth
            variant="contained"
            disableElevation
            disabled={submitting}
            onClick={handleRegisterCard}
            sx={{ mt: 2, height: 50, borderRadius: 1.5, fontWeight: 900 }}
          >
            {submitting ? <CircularProgress size={22} color="inherit" /> : "카드 등록하고 구독 시작"}
          </Button>
          <Typography color="text.secondary" fontSize={12} textAlign="center" sx={{ mt: 1.5 }}>
            구독을 해지해도 현재 이용기간이 끝날 때까지 사용할 수 있습니다.
          </Typography>
        </>
      ) : (
        <>
          <Alert severity="error">{error || "선택한 요금제를 확인할 수 없습니다."}</Alert>
          <Button variant="outlined" onClick={() => navigate("/mypage/pricing")} sx={{ mt: 2 }}>
            요금제로 돌아가기
          </Button>
        </>
      )}
    </Stack>
  );
}
