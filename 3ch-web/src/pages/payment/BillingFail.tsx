import { useNavigate, useSearchParams } from "react-router-dom";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";

export default function BillingFail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const message = searchParams.get("message") || "카드 등록이 취소되었거나 실패했습니다.";

  return (
    <Box sx={{ minHeight: "60vh", display: "grid", placeItems: "center", px: 3 }}>
      <Stack alignItems="center" spacing={2} sx={{ width: "100%" }}>
        <ErrorOutlineIcon sx={{ fontSize: 64, color: "#EF4444" }} />
        <Typography variant="h6" fontWeight={900}>카드 등록 실패</Typography>
        <Alert severity="error" sx={{ width: "100%" }}>{message}</Alert>
        <Button variant="outlined" onClick={() => navigate("/mypage/pricing", { replace: true })}>
          요금제로 돌아가기
        </Button>
      </Stack>
    </Box>
  );
}
