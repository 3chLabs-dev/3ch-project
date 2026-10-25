const { randomUUID } = require('crypto');
const conflict = (message) => Object.assign(new Error(message), { statusCode: 409 });

function outcome(match) {
  if (match.status !== 'completed') return null;
  const a = match.participant_a_id, b = match.participant_b_id;
  if (a && b) {
    if (match.score_a == null || match.score_b == null || match.score_a === match.score_b) throw conflict('토너먼트는 양쪽 점수와 승자가 확정되어야 합니다.');
    return match.score_a > match.score_b ? { winner: a, loser: b } : { winner: b, loser: a };
  }
  return match.is_bye ? { winner: a || b || null, loser: null } : null;
}

// Projection is used only to fill empty, unplayed slots on persisted edges.
// Existing assignments/results are authoritative and can never be reset here.
function projectBracketAdvancement(matches) {
  const rows = structuredClone(matches), byId = new Map(rows.map((m) => [m.id, m]));
  const incoming = new Map(), visiting = new Set(), visited = new Set();
  for (const source of rows) for (const [idKey, slotKey] of [['next_match_id','next_slot'],['loser_next_match_id','loser_next_slot']]) {
    const id = source[idKey], slot = source[slotKey];
    if (!id && !slot) continue;
    const target = byId.get(id);
    if (!target || !['a','b'].includes(slot) || target.division_id !== source.division_id || target.program_round !== source.program_round) throw conflict('저장된 토너먼트 연결 정보를 확인해주세요.');
    const key = `${id}:${slot}`;
    if (incoming.has(key)) throw conflict('같은 진출 칸에 두 경기가 연결되어 있습니다.');
    incoming.set(key, source);
  }
  function visit(id) {
    if (visiting.has(id)) throw conflict('토너먼트 연결에 순환이 있습니다.');
    if (visited.has(id)) return;
    visiting.add(id);
    const row = byId.get(id);
    for (const target of [row.next_match_id,row.loser_next_match_id].filter(Boolean)) visit(target);
    visiting.delete(id); visited.add(id);
  }
  for (const row of rows) visit(row.id);
  for (let pass = 0; pass <= rows.length; pass++) {
    let changed = false;
    for (const source of rows) {
      const result = outcome(source); if (!result) continue;
      for (const [idKey,slotKey,personKey] of [['next_match_id','next_slot','winner'],['loser_next_match_id','loser_next_slot','loser']]) {
        if (!source[idKey]) continue;
        const target = byId.get(source[idKey]), key = `participant_${source[slotKey]}_id`, person = result[personKey];
        if (target[key] === person || (!target[key] && !person)) continue;
        if (target[key] || target.status !== 'pending' || target.score_a != null || target.score_b != null) throw conflict('다음 경기의 참가자 또는 결과가 이미 저장되어 있어 진출자를 변경할 수 없습니다.');
        if (person) {
          target[key] = person;
          if (source.league_data) {
            const from = source.participant_a_id === person ? 'a' : 'b';
            const to = source[slotKey];
            target.league_data = { ...(target.league_data ?? {}) };
            for (const field of ['id','name','division','roster','roster_details','roster_ids']) {
              const value = source.league_data[`participant_${from}_${field}`];
              if (value !== undefined) target.league_data[`participant_${to}_${field}`] = value;
            }
          }
          changed = true;
        }
      }
    }
    for (const target of rows) {
      if (target.status !== 'pending' || target.score_a != null || target.score_b != null || (target.participant_a_id && target.participant_b_id)) continue;
      // An explicit editor assignment is a placement, not a completed walkover.
      if (target.league_data?.manual_assigned_slots?.length) continue;
      const feeders = ['a','b'].map((slot) => incoming.get(`${target.id}:${slot}`));
      const allFeedersArrived = feeders.every(Boolean) && feeders.every((feeder,index) => {
        const result = outcome(feeder); if (!result) return false;
        const slot = index === 0 ? 'a' : 'b';
        const person = feeder.next_match_id === target.id && feeder.next_slot === slot ? result.winner : result.loser;
        return (target[`participant_${slot}_id`] ?? null) === person;
      });
      if ((target.is_bye && feeders.every((f) => !f)) || allFeedersArrived) {
        target.status = 'completed'; target.is_bye = true; changed = true;
      }
    }
    if (!changed) return rows;
  }
  throw conflict('토너먼트 진출 처리를 완료할 수 없습니다.');
}

function seededOrder(size) {
  let seeds = [1,2];
  while (seeds.length < size) { const n = seeds.length * 2 + 1; seeds = seeds.flatMap((seed) => [seed,n-seed]); }
  return seeds;
}

function seedParticipants(players) {
  const size = 2 ** Math.ceil(Math.log2(players.length));
  const seedPositions = seededOrder(size).map((seed,index) => ({seed,index})).filter((p) => p.seed <= players.length);
  const slots = Array(size).fill(null), depth = Math.log2(size), trees = new Map();
  // Seed preference is secondary to avoiding early same-club/pool meetings.
  for (const [index, person] of players.entries()) {
    let best, bestCost = Infinity;
    for (const candidate of seedPositions.filter((p) => !slots[p.index])) {
      let cost = Math.abs(candidate.seed - (index + 1)) / (size * 100);
      for (const [group,weight] of [[person.source_group_id ? `club:${person.source_group_id}` : null,100000],[person.source_pool ? `pool:${person.source_pool}` : null,1000]]) {
        if (!group || !trees.has(group)) continue;
        const counts = trees.get(group);
        for (let level = 1; level <= depth; level++) {
          const sameSubtree = counts.get(`${level}:${candidate.index >> level}`) ?? 0;
          const sameHalf = counts.get(`${level-1}:${candidate.index >> (level-1)}`) ?? 0;
          cost += weight * (sameSubtree - sameHalf) * size / (2 ** level);
        }
      }
      if (cost < bestCost) { best = candidate; bestCost = cost; }
    }
    slots[best.index] = person;
    for (const group of [person.source_group_id ? `club:${person.source_group_id}` : null,person.source_pool ? `pool:${person.source_pool}` : null].filter(Boolean)) {
      if (!trees.has(group)) trees.set(group,new Map());
      const counts = trees.get(group);
      for (let level = 0; level <= depth; level++) {
        const key = `${level}:${best.index >> level}`;
        counts.set(key,(counts.get(key) ?? 0)+1);
      }
    }
  }
  return slots;
}

function buildKnockoutBracket(players, { divisionId, roundNo, mode = 'single', makeId = randomUUID } = {}) {
  if (players.length < 2 || players.length > 1024 || new Set(players.map((p) => p.id)).size !== players.length) throw conflict('토너먼트 참가자는 중복 없이 2~1024명이어야 합니다.');
  if (!['single','upper-lower'].includes(mode)) throw conflict('토너먼트 방식을 확인해주세요.');
  const slots = seedParticipants(players), rows = [];
  let order = 0;
  function createTree(count, bracket, startRound) {
    const levels = [];
    for (let remaining = count / 2, r = startRound; remaining >= 1; remaining /= 2, r++) {
      const label = remaining === 1 ? '결승' : remaining === 2 ? '준결승' : `${remaining*2}강`;
      const level = Array.from({ length: remaining }, () => ({ id: makeId(), division_id: divisionId, program_round: roundNo, phase: 'TOURNAMENT', bracket, bracket_index: 1, round_no: r, match_order: ++order, match_label: `${mode === 'upper-lower' ? (bracket === 'lower' ? '하위 ' : '상위 ') : ''}${label}`, participant_a_id: null, participant_b_id: null, score_a: null, score_b: null, status: 'pending', is_bye: false, next_match_id: null, next_slot: null, loser_next_match_id: null, loser_next_slot: null }));
      levels.push(level); rows.push(...level);
    }
    for (let r = 0; r < levels.length - 1; r++) levels[r].forEach((m,i) => { m.next_match_id = levels[r+1][Math.floor(i/2)].id; m.next_slot = i%2 ? 'b' : 'a'; });
    return levels;
  }
  const upper = createTree(slots.length,'upper',1);
  upper[0].forEach((m,i) => { m.participant_a_id=slots[i*2]?.id??null; m.participant_b_id=slots[i*2+1]?.id??null; m.is_bye=!m.participant_a_id || !m.participant_b_id; });
  if (mode === 'upper-lower' && slots.length >= 4) {
    const lower = createTree(slots.length/2,'lower',2);
    upper[0].forEach((m,i) => { m.loser_next_match_id=lower[0][Math.floor(i/2)].id; m.loser_next_slot=i%2?'b':'a'; });
  }
  return projectBracketAdvancement(rows);
}

async function advancePersistedBracket(client, divisionId, programRound) {
  const saved = await client.query("SELECT * FROM tournament_matches WHERE division_id=$1 AND program_round=$2 AND phase='TOURNAMENT' ORDER BY id FOR UPDATE", [divisionId,programRound]);
  const projected = projectBracketAdvancement(saved.rows);
  for (const row of projected) {
    const original = saved.rows.find((m) => m.id === row.id);
    if (['participant_a_id','participant_b_id','status','is_bye'].every((key) => row[key] === original[key]) && JSON.stringify(row.league_data)===JSON.stringify(original.league_data)) continue;
    if (row.league_data) await client.query('UPDATE tournament_matches SET participant_a_id=$1,participant_b_id=$2,status=$3,is_bye=$4,league_data=$5::jsonb WHERE id=$6', [row.participant_a_id,row.participant_b_id,row.status,row.is_bye,JSON.stringify(row.league_data),row.id]);
    else await client.query('UPDATE tournament_matches SET participant_a_id=$1,participant_b_id=$2,status=$3,is_bye=$4 WHERE id=$5', [row.participant_a_id,row.participant_b_id,row.status,row.is_bye,row.id]);
  }
}

async function guardQualifiedSourceResults(client, original, next) {
  if (original.status !== 'completed' || original.program_round == null || (original.score_a === next.score_a && original.score_b === next.score_b)) return;
  const later = await client.query("SELECT 1 FROM tournament_matches WHERE division_id=$1 AND program_round>$2 AND status<>'cancelled' LIMIT 1", [original.division_id,original.program_round]);
  if (later.rowCount) throw conflict('다음 라운드가 이미 생성되어 이전 라운드의 결과를 변경할 수 없습니다. 저장된 진출자와 대진표는 유지됩니다.');
}

module.exports = { guardQualifiedSourceResults, buildKnockoutBracket, projectBracketAdvancement, advancePersistedBracket, seedParticipants };
