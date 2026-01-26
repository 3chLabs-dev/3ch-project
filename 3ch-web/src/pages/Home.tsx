import { Stack, Card, CardContent, Typography, Button } from "@mui/material";

export default function Home() {
  return (
    <Stack spacing={2}>
      <Typography variant="h6" fontWeight={900}>홈</Typography>

      <Card>
        <CardContent>
          <Typography fontWeight={800}>진행중 경기</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            오늘 진행중인 경기가 없습니다.
          </Typography>
          <Button variant="contained" sx={{ mt: 1.5 }}>
            경기 만들기
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography fontWeight={800}>내 리그</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            참가중인 리그가 없습니다.
          </Typography>
        </CardContent>
      </Card>
    </Stack>
  );
}
