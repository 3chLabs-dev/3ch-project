const { z } = require('zod');

const entryConfigSchema = z.object({
  source_division_ids: z.array(z.string().uuid()).max(50).default([]),
  start_round: z.number().int().min(1).max(30).default(1),
}).strict();
const entryConfig = division => division.rules?.entry_config ?? { source_division_ids: [], start_round: 1 };
const entryDivisionIds = division => {
  const sources = entryConfig(division).source_division_ids;
  return sources?.length ? sources : [division.id];
};
const isRegistrationDivision = division => !entryConfig(division).source_division_ids?.length;

async function validateEntryConfig(client, tournamentId, divisionId, config) {
  const parsed = entryConfigSchema.safeParse(config);
  const fail = message => { throw Object.assign(new Error(message), { statusCode: 409 }); };
  if (!parsed.success) fail('참가 대상 부문과 시작 라운드를 확인해주세요.');
  const ids = parsed.data.source_division_ids;
  if (new Set(ids).size !== ids.length || ids.includes(divisionId)) fail('참가 대상 부문이 중복되거나 자기 자신을 포함합니다.');
  if (ids.length === 1) fail('통합할 신청 부문을 두 개 이상 선택해주세요.');
  if (ids.length) {
    const found = await client.query('SELECT * FROM tournament_divisions WHERE tournament_id=$1 AND id=ANY($2::uuid[]) FOR SHARE', [tournamentId, ids]);
    if (found.rowCount !== ids.length || found.rows.some(d => !isRegistrationDivision(d))) fail('같은 대회의 신청 부문만 통합 대상으로 선택할 수 있습니다.');
    if (divisionId) {
      const dependants = await client.query("SELECT 1 FROM tournament_divisions WHERE tournament_id=$1 AND (rules->'entry_config'->'source_division_ids') ? $2::text LIMIT 1", [tournamentId,divisionId]);
      if (dependants.rowCount) fail('다른 통합 경기에서 사용하는 신청 부문은 전환할 수 없습니다.');
      const registrations = await client.query('SELECT 1 FROM tournament_participants WHERE division_id=$1 LIMIT 1', [divisionId]);
      if (registrations.rowCount) fail('신청자가 있는 부문을 통합 구성으로 전환할 수 없습니다.');
    }
  }
  return parsed.data;
}

module.exports = { entryConfigSchema, entryConfig, entryDivisionIds, isRegistrationDivision, validateEntryConfig };
