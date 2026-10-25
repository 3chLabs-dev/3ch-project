import type { ProgramOption } from '../features/league/types/tournament.types';
export const TOURNAMENT_START_SIZES = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024];
export type TournamentEntrant = { id: string | null; name: string | null; level?: number | null };

export function hasCappedTournamentEntryChanges(previous?: Pick<ProgramOption, 'blocks'>, next?: Pick<ProgramOption, 'blocks'>) {
  return Array.from({ length: Math.max(previous?.blocks.length ?? 0, next?.blocks.length ?? 0) }, (_, index) => index).some(index => {
    const before = previous?.blocks[index], after = next?.blocks[index];
    if (!before?.tournamentStartSize && !after?.tournamentStartSize) return false;
    return (['tournamentStartSize','tournamentSelectedIds','tournamentSeeding'] as const).some(key => JSON.stringify(before?.[key] ?? null) !== JSON.stringify(after?.[key] ?? null));
  });
}

export function tournamentCutoff<T extends TournamentEntrant>(players: T[], size: number) {
  const level = (player: T) => player.level && player.level > 0 ? player.level : Number.MAX_SAFE_INTEGER;
  const ordered = [...players].sort((a, b) => level(a) - level(b));
  const tied = players.length > size && level(ordered[size - 1]) === level(ordered[size]);
  const boundary = ordered[Math.min(size, players.length) - 1];
  const mandatory = tied ? ordered.filter(player => level(player) < level(boundary)) : ordered.slice(0, size);
  const candidates = tied ? ordered.filter(player => level(player) === level(boundary)) : [];
  return { ordered, mandatory, candidates, remaining: Math.min(size, players.length) - mandatory.length, tied };
}

export function resolveTournamentEntrants<T extends TournamentEntrant>(
  players: T[], size: number, mode: 'manual' | 'seed' | 'random', selectedIds: string[] | undefined,
  shuffle: (players: T[]) => T[],
): T[] | null {
  if (!TOURNAMENT_START_SIZES.includes(size)) return null;
  if (mode === 'manual') return [];
  if (mode === 'random') return shuffle(players).slice(0, size);
  const cutoff = tournamentCutoff(players, size);
  let selected = cutoff.mandatory;
  if (cutoff.tied) {
    if (!selectedIds || new Set(selectedIds).size !== size || selectedIds.length !== size) return null;
    const allowed = new Set([...cutoff.mandatory, ...cutoff.candidates].map(player => player.id));
    if (selectedIds.some(id => !allowed.has(id)) || cutoff.mandatory.some(player => !selectedIds.includes(player.id!))) return null;
    selected = cutoff.ordered.filter(player => selectedIds.includes(player.id!));
  }
  // Equal-level seeding is random but stable for this saved participant set.
  const randomized = shuffle(selected);
  return randomized.sort((a, b) => (a.level || Number.MAX_SAFE_INTEGER) - (b.level || Number.MAX_SAFE_INTEGER));
}
