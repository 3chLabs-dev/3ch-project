import { useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress, Snackbar, Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import {
  createRenewalLeague,
  resetRenewalCreateStatus,
  setRenewalStep,
} from "../../features/league/leagueRenewalCreationSlice";
import { useGetMyFeatureUsageQuery } from "../../features/payment/usageApi";

export default function LeagueRenewalStep6Creating() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const status = useAppSelector((state) => state.leagueRenewalCreation.createStatus);
  const error = useAppSelector((state) => state.leagueRenewalCreation.createError);
  const token = useAppSelector((state) => state.auth.token);
  const [errorToastOpen, setErrorToastOpen] = useState(false);
  const {
    data: featureUsageData,
    isLoading: featureUsageLoading,
    isError: featureUsageError,
  } = useGetMyFeatureUsageQuery(undefined, { skip: !token });
  const eventBalance = featureUsageData?.usage.league_create;
  const clientQuotaExhausted = Boolean(
    eventBalance && !eventBalance.unlimited && (eventBalance.remaining ?? 0) <= 0,
  );

  useEffect(() => {
    if (
      status === "idle"
      && !featureUsageLoading
      && !clientQuotaExhausted
      && (featureUsageData || featureUsageError || !token)
    ) {
      dispatch(createRenewalLeague());
    }
  }, [
    clientQuotaExhausted,
    dispatch,
    featureUsageData,
    featureUsageError,
    featureUsageLoading,
    status,
    token,
  ]);

  useEffect(() => {
    if (status === "succeeded") dispatch(setRenewalStep(9));
  }, [dispatch, status]);

  useEffect(() => {
    if (status === "failed" && error) setErrorToastOpen(true);
  }, [error, status]);

  const handleBack = () => {
    dispatch(resetRenewalCreateStatus());
    dispatch(setRenewalStep(7));
  };
  const quotaExhausted = clientQuotaExhausted || error === "EVENT_CREATE_QUOTA_EXHAUSTED";
  const creationFailed = status === "failed" || clientQuotaExhausted;

  return (
    <Box
      sx={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        px: 3,
      }}
    >
      {!creationFailed && <CircularProgress size={48} />}
      <Typography fontWeight={800} textAlign="center">
        {creationFailed
          ? quotaExhausted
            ? "사용 가능한 리그 생성 횟수가 없습니다."
            : error ?? "리그 생성에 실패했습니다."
          : "리그를 생성하고 있습니다."}
      </Typography>
      {quotaExhausted && (
        <Typography color="text.secondary" fontSize={13} textAlign="center">
          요금제를 변경하거나 다음 이용 기간까지 기다려 주세요.
        </Typography>
      )}
      {creationFailed && (
        <Stack spacing={1} sx={{ width: "100%", maxWidth: 350, mt: 1 }}>
          {quotaExhausted && (
            <Button
              fullWidth
              variant="contained"
              onClick={() => navigate("/mypage/pricing#token-packages")}
              sx={{
                height: 44,
                borderRadius: 1,
                fontWeight: 900,
                bgcolor: "#7C3AED",
                "&:hover": { bgcolor: "#6D28D9" },
              }}
            >
              추가 사용량 구매
            </Button>
          )}
          {quotaExhausted && (
            <Button
              fullWidth
              variant="outlined"
              onClick={() => navigate("/mypage/pricing")}
              sx={{ height: 44, borderRadius: 1, fontWeight: 900 }}
            >
              요금제 보기
            </Button>
          )}
          <Button
            fullWidth
            variant="outlined"
            onClick={handleBack}
            sx={{ height: 44, borderRadius: 1, fontWeight: 900 }}
          >
            이전 단계로
          </Button>
        </Stack>
      )}
      <Snackbar open={errorToastOpen} autoHideDuration={6000} onClose={() => setErrorToastOpen(false)} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity="warning" onClose={() => setErrorToastOpen(false)} sx={{ fontWeight: 700 }}>{error}</Alert>
      </Snackbar>
    </Box>
  );
}
