import { MenuItem, TextField } from '@mui/material';
import { TOURNAMENT_START_SIZES } from '../utils/tournamentEntrants';

export default function TournamentStartSizeField({ value, onChange }: { value?: number; onChange: (value: number | undefined) => void }) {
  return <TextField select fullWidth size="small" label="시작 강수" value={value ?? ''}
    onChange={event => onChange(event.target.value === '' ? undefined : Number(event.target.value))}
    helperText="대진표별 참가 인원이며, 복식·단체전은 팀 수입니다. 미선정자도 신청 명단에는 유지됩니다." sx={{ mt: 2 }}>
    <MenuItem value="">자동 (전체 참가자)</MenuItem>
    {TOURNAMENT_START_SIZES.map(size => <MenuItem key={size} value={size}>{size === 2 ? '2강 (결승)' : `${size}강`}</MenuItem>)}
  </TextField>;
}
