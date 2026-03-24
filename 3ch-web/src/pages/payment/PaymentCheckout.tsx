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
  const amount = Number(searchParams.get("amount") ?? "0");
  const name   = searchParams.get("name")  ?? "요금제";

  const [ready, setReady] = useState(false);
  const widgetsRef  = useRef<Awaited<ReturnType<Awaited<ReturnType<typeof loadTossPayments>>["widgets"]>> | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    if (!user) { navigate("/login"); return; }
    if (!plan || !amount) { navigate("/mypage/pricing"); return; }

    (async () => {
      const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY);
      const widgets = tossPayments.widgets({ customerKey: `user_${user.id}` });
      widgetsRef.current = widgets;

      await widgets.setAmount({ currency: "KRW", value: amount });
      await Promise.all([
        widgets.renderPaymentMethods({ selector: "#toss-payment-method", variantKey: "DEFAULT" }),
        widgets.renderAgreement({ selector: "#toss-agreement", variantKey: "AGREEMENT" }),
      ]);
      setReady(true);
    })();
  }, []);

  const handlePay = async () => {
    if (!widgetsRef.current || !user) return;
    const orderId = `ORDER_${plan}_${user.id}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    await widgetsRef.current.requestPayment({
      orderId,
      orderName: `${name} 요금제`,
      successUrl: `${window.location.origin}/payment/success`,
      failUrl:    `${window.location.origin}/payment/fail`,
      customerEmail: user.email,
      customerName:  user.name ?? undefined,
    });
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
        <Typography fontWeight={800} fontSize={15}>{name} 요금제</Typography>
        <Typography fontWeight={900} fontSize={20} sx={{ mt: 0.5 }}>
          월 {amount.toLocaleString()}원
        </Typography>
      </Box>

      {/* 위젯 로딩 */}
      {!ready && (
        <Stack alignItems="center" sx={{ py: 6 }}>
          <CircularProgress size={28} />
        </Stack>
      )}

      {/* Toss 결제 위젯 */}
      <Box id="toss-payment-method" />
      <Box id="toss-agreement" sx={{ mt: 1 }} />

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
