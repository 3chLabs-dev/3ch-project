import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Box, CircularProgress, Typography, Button, Stack } from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import axios from "axios";
import { useSelector } from "react-redux";
import type { RootState } from "../../app/store";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = useSelector((s: RootState) => s.auth.token);

  const paymentKey = searchParams.get("paymentKey");
  const orderId    = searchParams.get("orderId");
  const amount     = searchParams.get("amount");

  // URL 파라미터가 없으면 렌더 시점에 바로 error 상태로 초기화
  const hasParams = !!(paymentKey && orderId && amount);
  const [status, setStatus] = useState<"loading" | "ok" | "error">(hasParams ? "loading" : "error");
  const [errorMsg, setErrorMsg] = useState(hasParams ? "" : "결제 정보가 올바르지 않습니다.");

  useEffect(() => {
    if (!hasParams) return;

    axios
      .post(
        `${apiBaseUrl}/payment/confirm`,
        { paymentKey, orderId, amount: Number(amount) },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .then(() => setStatus("ok"))
      .catch((e) => {
        setStatus("error");
        setErrorMsg(e.response?.data?.error ?? "결제 확인 중 오류가 발생했습니다.");
      });
  }, [hasParams, paymentKey, orderId, amount, token]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", p: 4 }}>
      {status === "loading" && (
        <Stack spacing={2} alignItems="center">
          <CircularProgress />
          <Typography fontWeight={700} color="text.secondary">결제를 확인하는 중...</Typography>
        </Stack>
      )}

      {status === "ok" && (
        <Stack spacing={2} alignItems="center">
          <CheckCircleOutlineIcon sx={{ fontSize: 64, color: "#10B981" }} />
          <Typography variant="h6" fontWeight={900}>결제가 완료되었습니다!</Typography>
          <Typography fontSize={14} color="text.secondary">요금제가 성공적으로 구독되었습니다.</Typography>
          <Button
            variant="contained"
            disableElevation
            onClick={() => navigate("/mypage/pricing")}
            sx={{ mt: 2, borderRadius: 1.5, fontWeight: 800, bgcolor: "#111827", "&:hover": { bgcolor: "#374151" } }}
          >
            요금제 확인하기
          </Button>
        </Stack>
      )}

      {status === "error" && (
        <Stack spacing={2} alignItems="center">
          <ErrorOutlineIcon sx={{ fontSize: 64, color: "#EF4444" }} />
          <Typography variant="h6" fontWeight={900}>결제에 실패했습니다</Typography>
          <Typography fontSize={14} color="text.secondary">{errorMsg}</Typography>
          <Button
            variant="outlined"
            onClick={() => navigate("/mypage/pricing")}
            sx={{ mt: 2, borderRadius: 1.5, fontWeight: 800 }}
          >
            돌아가기
          </Button>
        </Stack>
      )}
    </Box>
  );
}
