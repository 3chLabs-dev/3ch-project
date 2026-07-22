import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Box, IconButton, Stack, Typography } from "@mui/material";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import LeagueAlgorithmDemo from "../demo/LeagueAlgorithmDemo";
import { setRenewalConfiguration, setRenewalSelectedProgram, setRenewalStep } from "../../features/league/leagueRenewalCreationSlice";
import type { ProgramOption } from "../../features/league/types/tournament.types";

export default function LeagueRenewalStep3Program() {
  const dispatch = useAppDispatch();
  const basicInfo = useAppSelector((state) => state.leagueRenewalCreation.basicInfo);
  const hasParticipatingClubs = useAppSelector((state) => state.leagueRenewalCreation.invitedGroupIds.length > 0);

  if (!basicInfo) return null;

  const handleComplete = (program: ProgramOption) => {
    dispatch(setRenewalSelectedProgram(program));
    dispatch(setRenewalConfiguration({ format: "event-program", rule: null }));
    dispatch(setRenewalStep(7));
  };

  return (
    <Box sx={{ pt: 2, pb: 10 }}>
      <Stack direction="row" alignItems="center" sx={{ px: 2.5, mb: 2 }}>
        <IconButton
          size="small"
          aria-label="이전 단계로"
          onClick={() => dispatch(setRenewalStep(2))}
          sx={{ ml: -1, mr: 0.5 }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography sx={{ fontSize: 22, fontWeight: 900 }}>추천 프로그램</Typography>
      </Stack>
      <LeagueAlgorithmDemo
        embedded
        hideSetupInputs
        hideFormationActions
        hideHeader
        hideModeTabs
        hideRecommendationTitle
        compactCompleteButton
        hasParticipatingClubs={hasParticipatingClubs}
        initialPlayerCount={basicInfo.participantCount ?? 4}
        initialCourtCount={basicInfo.courtCount ?? 1}
        initialStartTime={basicInfo.startTime}
        initialEndTime={basicInfo.endTime}
        onBack={() => dispatch(setRenewalStep(2))}
        onComplete={handleComplete}
      />
    </Box>
  );
}
