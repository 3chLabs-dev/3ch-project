import { Box, Button, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { setRenewalConfiguration, setRenewalStep } from "../../features/league/leagueRenewalCreationSlice";
import type { LeagueFormatValue, LeagueRuleValue } from "../../features/league/leagueCreationSlice";

export default function LeagueRenewalStep4Rules() {
  const dispatch = useAppDispatch();
  const configuration = useAppSelector((state) => state.leagueRenewalCreation.configuration);
  return <Box sx={{ px: 2.5, pt: 2 }}><Typography sx={{ fontSize: 22, fontWeight: 900, mb: 2 }}>리그 방식 및 규칙</Typography><Stack spacing={2}><TextField select label="리그 방식" value={configuration.format ?? ""} onChange={(event) => dispatch(setRenewalConfiguration({ format: event.target.value as LeagueFormatValue }))}><MenuItem value="single-league">단일리그</MenuItem><MenuItem value="group-league">조별리그</MenuItem><MenuItem value="single-league-tournament">단일리그 + 토너먼트</MenuItem><MenuItem value="upper-lower-tournament">상·하위 토너먼트</MenuItem></TextField><TextField select label="리그 규칙" value={configuration.rule ?? ""} onChange={(event) => dispatch(setRenewalConfiguration({ rule: event.target.value as LeagueRuleValue }))}><MenuItem value="best-of-3">3전 2선승제</MenuItem><MenuItem value="best-of-5">5전 3선승제</MenuItem><MenuItem value="3-sets">3세트제</MenuItem></TextField></Stack><Stack direction="row" spacing={1.5} sx={{ mt: 4 }}><Button fullWidth variant="contained" onClick={() => dispatch(setRenewalStep(4))}>이전</Button><Button fullWidth variant="contained" disabled={!configuration.format || !configuration.rule} onClick={() => dispatch(setRenewalStep(6))}>다음</Button></Stack></Box>;
}
