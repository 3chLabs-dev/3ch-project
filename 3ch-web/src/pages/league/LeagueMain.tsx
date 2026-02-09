import React from "react";
import { useAppDispatch } from "../../app/hooks";
import { setStep } from "../../features/league/leagueCreationSlice";
import { Box, Stack, Typography, Card, CardContent, Button } from "@mui/material";

export default function LeagueMainBody() {
  const dispatch = useAppDispatch();
  const hasExistingLeagues = false;

  const handleCreateNewLeague = () => {
    dispatch(setStep(1));
  };

  return (
    <Stack spacing={2.0}>
      {/* 타이틀 */}
      <Box>
        <Typography variant="h6" fontWeight={900}>
          리그 일정
        </Typography>
      </Box>

      {/* 리그 일정 카드 */}
      <SoftCard>
        {hasExistingLeagues ? (
          <Typography fontWeight={700}>개설된 리그 목록…</Typography>
        ) : (
          <Typography textAlign="center" color="text.secondary" fontWeight={700}>
            개설된 리그가 없습니다.
          </Typography>
        )}
      </SoftCard>

      <Button
        fullWidth
        variant="contained"
        disableElevation
        onClick={handleCreateNewLeague}
        sx={{
          borderRadius: 1,
          py: 1.2,
          fontWeight: 900,
        }}
      >
        신규 생성하기
      </Button>
    </Stack>
  );
}

function SoftCard({ children }: { children: React.ReactNode }) {
  return (
    <Card
      elevation={2}
      sx={{
        p: 2,
        borderRadius: 1,
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
      }}
    >
      <CardContent
        sx={{
          py: 2.0,
          minHeight: 80,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        {children}
      </CardContent>
    </Card>
  );
}
