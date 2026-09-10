import { Button, Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <Stack alignItems="center" justifyContent="center" spacing={1.5} sx={{ minHeight: 360, textAlign: "center", px: 2 }}>
      <Typography fontSize={36} fontWeight={900} color="primary.main">404</Typography>
      <Typography variant="h6" fontWeight={900}>페이지를 찾을 수 없습니다.</Typography>
      <Typography fontSize={14} color="text.secondary">주소가 잘못되었거나 삭제된 페이지입니다.</Typography>
      <Button variant="contained" disableElevation onClick={() => navigate("/")} sx={{ mt: 1, fontWeight: 800 }}>홈으로 이동</Button>
    </Stack>
  );
}
