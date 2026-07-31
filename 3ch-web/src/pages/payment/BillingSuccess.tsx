import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import axios from "axios";
import { useSelector } from "react-redux";
import type { RootState } from "../../app/store";

const API = import.meta.env.VITE_API_BASE_URL ?? "/api";

export default function BillingSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = useSelector((state: RootState) => state.auth.token);
  const requestedRef = useRef(false);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (requestedRef.current) return;

    const authKey = searchParams.get("authKey");
    const customerKey = searchParams.get("customerKey");
    const planCode =
      searchParams.get("plan") ?? sessionStorage.getItem("billing_plan_code");
    const resolvedToken = token ?? localStorage.getItem("token");

    if (!authKey || !customerKey || !planCode) {
      requestedRef.current = true;
      setStatus("error");
      setMessage("자동결제 등록 정보가 올바르지 않습니다.");
      return;
    }
    if (!resolvedToken) return;

    requestedRef.current = true;

    axios.post(
      `${API}/payment/billing/issue`,
      { authKey, customerKey, planCode },
      { headers: { Authorization: `Bearer ${resolvedToken}` } },
    )
      .then(() => {
        sessionStorage.removeItem("billing_plan_code");
        setStatus("success");
      })
      .catch((error) => {
        setStatus("error");
        setMessage(
          error.response?.data?.message ||
          error.response?.data?.error ||
          "카드 등록 또는 첫 결제에 실패했습니다.",
        );
      });
  }, [searchParams, token]);

  return (
    <Box sx={{ minHeight: "60vh", display: "grid", placeItems: "center", px: 3 }}>
      {status === "loading" && (
        <Stack alignItems="center" spacing={2}>
          <CircularProgress />
          <Typography fontWeight={800}>카드를 등록하고 첫 결제를 처리하는 중입니다.</Typography>
        </Stack>
      )}
      {status === "success" && (
        <Stack alignItems="center" spacing={2}>
          <CheckCircleOutlineIcon sx={{ fontSize: 64, color: "#10B981" }} />
          <Typography variant="h6" fontWeight={900}>구독이 시작되었습니다.</Typography>
          <Typography color="text.secondary" fontSize={14}>다음 달부터 등록한 카드로 자동결제됩니다.</Typography>
          <Button variant="contained" onClick={() => navigate("/mypage/pricing", { replace: true })}>
            요금제 확인
          </Button>
        </Stack>
      )}
      {status === "error" && (
        <Stack alignItems="center" spacing={2} sx={{ width: "100%" }}>
          <ErrorOutlineIcon sx={{ fontSize: 64, color: "#EF4444" }} />
          <Typography variant="h6" fontWeight={900}>자동결제 등록에 실패했습니다.</Typography>
          <Alert severity="error" sx={{ width: "100%" }}>{message}</Alert>
          <Button variant="outlined" onClick={() => navigate("/mypage/pricing", { replace: true })}>
            요금제로 돌아가기
          </Button>
        </Stack>
      )}
    </Box>
  );
}
