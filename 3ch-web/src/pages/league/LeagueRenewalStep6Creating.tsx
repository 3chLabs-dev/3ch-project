import { useEffect } from "react";
import { Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { createRenewalLeague, resetRenewalCreateStatus, setRenewalStep } from "../../features/league/leagueRenewalCreationSlice";

export default function LeagueRenewalStep6Creating() {
  const dispatch = useAppDispatch();
  const status = useAppSelector((state) => state.leagueRenewalCreation.createStatus);
  const error = useAppSelector((state) => state.leagueRenewalCreation.createError);

  useEffect(() => {
    if (status === "idle") dispatch(createRenewalLeague());
  }, [dispatch, status]);

  useEffect(() => {
    if (status === "succeeded") dispatch(setRenewalStep(9));
  }, [dispatch, status]);

  const handleBack = () => {
    dispatch(resetRenewalCreateStatus());
    dispatch(setRenewalStep(7));
  };

  return <Box sx={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, px: 3 }}>
    {status !== "failed" && <CircularProgress size={48} />}
    <Typography fontWeight={800} textAlign="center">
      {status === "failed" ? error ?? "리그 생성에 실패했습니다." : "리그를 생성하고 있습니다."}
    </Typography>
    {status === "failed" && <Stack sx={{ width: "100%", maxWidth: 350, mt: 1 }}>
      <Button fullWidth variant="outlined" onClick={handleBack} sx={{ height: 44, borderRadius: 1, fontWeight: 900 }}>이전 단계로</Button>
    </Stack>}
  </Box>;
}
