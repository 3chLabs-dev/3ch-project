import { useSearchParams, useNavigate } from "react-router-dom";
import { Box, Typography, Button, Stack } from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";

export default function PaymentFail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const code    = searchParams.get("code") ?? "";
  const message = searchParams.get("message") ?? "결제가 취소되었습니다.";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", p: 4 }}>
      <Stack spacing={2} alignItems="center">
        <ErrorOutlineIcon sx={{ fontSize: 64, color: "#EF4444" }} />
        <Typography variant="h6" fontWeight={900}>결제에 실패했습니다</Typography>
        {code && <Typography fontSize={12} color="text.secondary">오류 코드: {code}</Typography>}
        <Typography fontSize={14} color="text.secondary" textAlign="center">{message}</Typography>
        <Button
          variant="outlined"
          onClick={() => navigate("/mypage/pricing")}
          sx={{ mt: 2, borderRadius: 1.5, fontWeight: 800 }}
        >
          돌아가기
        </Button>
      </Stack>
    </Box>
  );
}
