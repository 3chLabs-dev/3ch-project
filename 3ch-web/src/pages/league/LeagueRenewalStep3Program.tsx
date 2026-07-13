import { Box, Typography } from "@mui/material";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import LeagueAlgorithmDemo from "../demo/LeagueAlgorithmDemo";
import { setRenewalConfiguration, setRenewalSelectedProgram, setRenewalStep } from "../../features/league/leagueRenewalCreationSlice";
import type { ProgramOption } from "../../features/league/types/tournament.types";

export default function LeagueRenewalStep3Program() {
  const dispatch = useAppDispatch();
  const basicInfo = useAppSelector((state) => state.leagueRenewalCreation.basicInfo);

  if (!basicInfo) return null;

  const handleComplete = (program: ProgramOption) => {
    dispatch(setRenewalSelectedProgram(program));
    dispatch(setRenewalConfiguration({ format: "event-program", rule: null }));
    dispatch(setRenewalStep(7));
  };

  return (
    <Box sx={{ pt: 2, pb: 10 }}>
      <Typography sx={{ px: 2.5, fontSize: 22, fontWeight: 900, mb: 2 }}>
        추천 프로그램
      </Typography>
      <LeagueAlgorithmDemo
        embedded
        hideSetupInputs
        hideFormationActions
        hideHeader
        hideModeTabs
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
