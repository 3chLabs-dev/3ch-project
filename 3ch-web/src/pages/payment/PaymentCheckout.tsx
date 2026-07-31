import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Box, Typography, Button, Stack, CircularProgress, IconButton } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import { loadTossPayments } from "@tosspayments/tosspayments-sdk";
import { useSelector } from "react-redux";
import type { RootState } from "../../app/store";

const TOSS_CLIENT_KEY = import.meta.env.VITE_TOSS_CLIENT_KEY as string;

export default function PaymentCheckout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const user = useSelector((s: RootState) => s.auth.user);

  const plan   = searchParams.get("plan")   ?? "";
  const packageId = searchParams.get("packageId") ?? "";
  const paymentType = searchParams.get("type") === "token" ? "token" : "subscription";
  const amount = Number(searchParams.get("amount") ?? "0");
  const name   = searchParams.get("name")  ?? "요금제";

  const [ready, setReady] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const paymentRef = useRef<ReturnType<Awaited<ReturnType<typeof loadTossPayments>>["payment"]> | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    if (!user) { navigate("/login"); return; }
    if (!(paymentType === "token" ? packageId : plan) || !amount) {
      navigate("/mypage/pricing");
      return;
    }

    if (!TOSS_CLIENT_KEY) {
      setCheckoutError("결제 설정을 불러오지 못했습니다.");
      return;
    }

    (async () => {
      try {
        const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY);
        paymentRef.current = tossPayments.payment({ customerKey: `user_${user.id}` });
        setReady(true);
      } catch {
        setCheckoutError("결제를 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
    })();
  }, []);

  const handlePay = async () => {
    if (!paymentRef.current || !user) return;
    const orderId = paymentType === "token"
      ? `TOKEN_${packageId}_${user.id}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`
      : `ORDER_${plan}_${user.id}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    try {
      await paymentRef.current.requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: amount },
        orderId,
        orderName: paymentType === "token" ? name : `${name} 요금제`,
        successUrl: `${window.location.origin}/payment/success?type=${paymentType}`,
        failUrl: `${window.location.origin}/payment/fail`,
        customerEmail: user.email,
        customerName: user.name ?? undefined,
        card: {
          useEscrow: false,
          flowMode: "DEFAULT",
          useCardPoint: false,
          useAppCardOnly: false,
        },
      });
    } catch {
      setCheckoutError("결제를 시작하지 못했습니다. 다시 시도해 주세요.");
    }
  };

  return (
    <Stack sx={{ width: "100%", mx: "auto", mt: "-4px" }}>
      {/* 헤더 */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <IconButton onClick={() => navigate(-1)} size="small">
          <ChevronLeftIcon />
        </IconButton>
        <Typography variant="h6" fontWeight={900}>결제하기</Typography>
      </Stack>

      {/* 플랜 요약 */}
      <Box sx={{ bgcolor: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 2, p: 2, mb: 2 }}>
        <Typography fontWeight={800} fontSize={15}>
          {paymentType === "token" ? name : `${name} 요금제`}
        </Typography>
        <Typography fontWeight={900} fontSize={20} sx={{ mt: 0.5 }}>
          {paymentType === "token" ? "" : "월 "}{amount.toLocaleString()}원
        </Typography>
      </Box>

      {/* 위젯 로딩 */}
      {!ready && (
        <Stack alignItems="center" sx={{ py: 6 }}>
          {checkoutError ? (
            <Typography color="error" fontSize={14} textAlign="center">
              {checkoutError}
            </Typography>
          ) : (
            <CircularProgress size={28} />
          )}
        </Stack>
      )}

      {/* 결제 버튼 */}
      <Button
        fullWidth
        variant="contained"
        disableElevation
        disabled={!ready}
        onClick={handlePay}
        sx={{
          mt: 2,
          height: 50,
          borderRadius: 2,
          fontWeight: 900,
          fontSize: 16,
          bgcolor: "#111827",
          "&:hover": { bgcolor: "#374151" },
        }}
      >
        {amount.toLocaleString()}원 결제하기
      </Button>
    </Stack>
  );
}
