const { generateProgramRoundMatches } = require('../shared/leagueProgramEngine.cjs');
const conflict = message => Object.assign(new Error(message), { statusCode: 409 });
const fields = ['tournamentStartSize', 'tournamentSelectedIds', 'tournamentSeeding'];

function validateTournamentEntrySettings(program) {
  for (const block of [...(program?.blocks ?? []), ...(program?.rounds ?? [])]) {
    if (block.tournamentStartSize != null && ![2,4,8,16,32,64,128,256,512,1024].includes(block.tournamentStartSize)) throw conflict('시작 강수를 확인해주세요.');
    if (block.tournamentSelectedIds != null && (typeof block.tournamentSelectedIds !== 'object' || Array.isArray(block.tournamentSelectedIds)
      || Object.values(block.tournamentSelectedIds).some(ids => !Array.isArray(ids) || ids.length > 1024 || new Set(ids).size !== ids.length || ids.some(id => typeof id !== 'string' || id.length > 5000)))) throw conflict('토너먼트 선정 명단을 확인해주세요.');
  }
}
function guardTournamentEntryChanges(previous, next, matches) {
  validateTournamentEntrySettings(next);
  for (const match of matches) {
    const index = (match.program_round ?? 1) - 1;
    if (!previous?.blocks?.[index]?.tournamentStartSize && !next?.blocks?.[index]?.tournamentStartSize) continue;
    if (fields.some(field => JSON.stringify(previous?.blocks?.[index]?.[field] ?? null) !== JSON.stringify(next?.blocks?.[index]?.[field] ?? null))) {
      throw conflict('이미 경기가 생성된 라운드의 시작 강수·배치 방식·선정 명단은 일반 저장으로 변경할 수 없습니다. 기존 경기는 보존됩니다.');
    }
  }
}
function validateCappedRoundMatches(leagueId, program, round, participants, incoming) {
  const block = program?.blocks?.[round - 1];
  if (block?.format !== 'TOURNAMENT' || block.roundOption === 'FINAL' || !block.tournamentStartSize) return;
  validateTournamentEntrySettings(program);
  const expected = generateProgramRoundMatches(leagueId, program, participants, round, []);
  if (!expected.length) throw conflict('시드 커트라인의 동률 참가자를 먼저 선정해주세요.');
  const actual = incoming.filter(match => Number(match.program_round) === round);
  const byId = new Map(actual.map(match => [match.id, match]));
  if (actual.length !== expected.length || expected.some(match => {
    const found = byId.get(match.id);
    return !found || ['participant_a_id','participant_b_id','round_number','bracket','next_match_id','next_slot','loser_next_match_id','loser_next_slot'].some(key => (found[key] ?? null) !== (match[key] ?? null));
  })) throw conflict('시작 강수와 저장된 선정 명단에 맞지 않는 대진표입니다. 참가자 선정을 다시 확인해주세요.');
}
module.exports = { validateTournamentEntrySettings, guardTournamentEntryChanges, validateCappedRoundMatches };
