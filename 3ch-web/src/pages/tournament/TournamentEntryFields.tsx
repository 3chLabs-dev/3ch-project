import { Box, Checkbox, FormControlLabel, Typography } from "@mui/material";
import { OptionalNumberStepper, rowSx } from "../league/LeagueRenewalStep1BasicInfo";

export interface TournamentEntryConfig { source_division_ids: string[]; start_round: number }
export const getEntryConfig = (division: { rules?: Record<string, unknown> }): TournamentEntryConfig =>
  (division.rules?.entry_config as TournamentEntryConfig | undefined) ?? { source_division_ids: [], start_round: 1 };

export function TournamentEntryFields({ config, onChange, divisions, merged, disabled = false }: {
  config: TournamentEntryConfig;
  onChange: (config: TournamentEntryConfig) => void;
  divisions: Array<{ id: string; name: string }>;
  merged: boolean;
  disabled?: boolean;
}) {
  return <>
    <Box sx={rowSx}><Typography fontWeight={900}>시작 라운드</Typography><OptionalNumberStepper value={config.start_round} onChange={value => onChange({ ...config, start_round: value === "" ? 1 : value })} min={1} max={30} suffix="" /></Box>
    {merged && <Box sx={{ py: 1 }}>
      <Typography sx={{ fontSize: 14, fontWeight: 800 }}>참가 대상 부문</Typography>
      <Box>{divisions.map(division => <FormControlLabel key={division.id} label={division.name} control={<Checkbox disabled={disabled} size="small" checked={config.source_division_ids.includes(division.id)} onChange={(_, checked) => onChange({ ...config, source_division_ids: checked ? [...config.source_division_ids, division.id] : config.source_division_ids.filter(id => id !== division.id) })} />} />)}</Box>
      <Typography sx={{ color: "text.secondary", fontSize: 12 }}>선택한 신청 부문의 확정 참가자 전원을 연결합니다. 이전 라운드의 진출 여부와 별개로 새 예선을 구성할 수 있습니다.</Typography>
    </Box>}
  </>;
}
