import { useMemo, useState } from 'react';
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Typography } from '@mui/material';
import type { LeagueMatch, LeagueParticipantItem } from '../features/league/leagueApi';
import { useSaveLeagueProgramMutation, useSyncLeagueProgramMatchesMutation } from '../features/league/leagueApi';
import type { ProgramOption } from '../features/league/types/tournament.types';
import { generateProgramRoundMatches, getProgramTournamentSelectionPools } from '../utils/programMatchGenerator';

export default function TournamentEntrantSelection({ leagueId, program, round, participants, matches, canManage, onSaved }: {
  leagueId: string; program: ProgramOption; round: number; participants: LeagueParticipantItem[]; matches: LeagueMatch[];
  canManage: boolean; onSaved: (program: ProgramOption) => void;
}) {
  const [open, setOpen] = useState(false), [selected, setSelected] = useState<Record<string, string[]>>({});
  const [error, setError] = useState('');
  const [save, { isLoading: saving }] = useSaveLeagueProgramMutation();
  const [sync, { isLoading: syncing }] = useSyncLeagueProgramMatchesMutation();
  const block = program.blocks[round - 1];
  const pools = useMemo(() => getProgramTournamentSelectionPools(leagueId, program, participants, round, matches), [leagueId, program, participants, round, matches]);
  const exists = matches.some(match => match.program_round === round);
  if (!block.tournamentStartSize || block.roundOption === 'FINAL') return null;
  const ready = pools.every(pool => (selected[String(pool.index)]?.length ?? 0) === pool.remaining);
  const confirm = async () => {
    if (exists || !ready) return;
    setError('');
    const ids = Object.fromEntries(pools.map(pool => [String(pool.index), [...pool.mandatory.map(person => person.id), ...(selected[String(pool.index)] ?? [])]]));
    const next: ProgramOption = { ...program,
      blocks: program.blocks.map((item, index) => index === round - 1 ? { ...item, tournamentSelectedIds: ids } : item),
      rounds: program.rounds?.map((item, index) => index === round - 1 ? { ...item, tournamentSelectedIds: ids } : item),
    };
    try {
      const generated = generateProgramRoundMatches(leagueId, next, participants, round, matches);
      if (!generated.length) throw Error('편성과 참가자 명단을 확인해주세요.');
      const saved = await save({ leagueId, program: next }).unwrap();
      const authoritative = (saved.program?.program_data ?? next) as ProgramOption;
      onSaved(authoritative);
      await sync({ leagueId, matches: generated }).unwrap();
      setOpen(false);
    } catch (err) {
      const value = err as { data?: { message?: string }; message?: string };
      setError(value.data?.message ?? value.message ?? '참가자 선정을 저장하지 못했습니다.');
    }
  };
  return <Box sx={{ mb: 1 }}>
    <Typography fontSize={12} color="text.secondary" sx={{ mb: .5 }}>{block.tournamentStartSize}강 · 미선정자는 참가신청 명단에 유지됩니다.</Typography>
    {!exists && pools.length > 0 && <>
      <Typography fontSize={12} sx={{ mb: .5 }}>시드 커트라인에 같은 부수가 있어 참가자 선정이 필요합니다.</Typography>
      {canManage && <Button fullWidth variant="outlined" size="small" onClick={() => {
        setSelected(Object.fromEntries(pools.map(pool => [String(pool.index), (block.tournamentSelectedIds?.[String(pool.index)] ?? []).filter(id => pool.candidates.some(person => person.id === id))])));
        setError(''); setOpen(true);
      }} sx={{ borderRadius: 1.5, fontWeight: 800 }}>참가자 선정</Button>}
    </>}
    <Dialog open={open} onClose={() => { if (!saving && !syncing) setOpen(false); }} fullWidth maxWidth="xs">
      <DialogTitle fontWeight={900}>토너먼트 참가자 선정</DialogTitle>
      <DialogContent dividers>
        {pools.map(pool => <Box key={pool.index} sx={{ mb: 2 }}>
          {pools.length > 1 && <Typography fontWeight={800}>{pool.index}번 대진표</Typography>}
          <Typography fontSize={13}>상위 {pool.mandatory.length}명 자동 선정 · 동률자 중 {pool.remaining}명 선택 ({selected[String(pool.index)]?.length ?? 0}/{pool.remaining})</Typography>
          {pool.mandatory.length > 0 && <Typography fontSize={12} color="text.secondary" sx={{ my: 1 }}>자동 선정: {pool.mandatory.map(person => person.name).join(', ')}</Typography>}
          {pool.candidates.map(person => {
            const checked = selected[String(pool.index)]?.includes(person.id) ?? false;
            return <FormControlLabel key={person.id} sx={{ display: 'flex' }} label={`${person.name} · ${person.level || '미설정'}부`}
              control={<Checkbox checked={checked} disabled={!checked && (selected[String(pool.index)]?.length ?? 0) >= pool.remaining || saving || syncing}
                onChange={(_, value) => setSelected(current => ({ ...current, [String(pool.index)]: value ? [...(current[String(pool.index)] ?? []), person.id] : (current[String(pool.index)] ?? []).filter(id => id !== person.id) }))} />} />;
          })}
        </Box>)}
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions><Button disabled={saving || syncing} onClick={() => setOpen(false)}>취소</Button><Button variant="contained" disabled={!ready || exists || saving || syncing} onClick={() => void confirm()}>{saving || syncing ? '저장 중…' : '선정 확정 및 대진표 생성'}</Button></DialogActions>
    </Dialog>
  </Box>;
}
