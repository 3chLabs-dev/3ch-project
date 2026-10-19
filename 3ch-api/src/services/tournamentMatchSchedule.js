// Circle scheduling preserves persisted pool membership and slot order.
function buildPoolMatchSchedule(assignments) {
  const pools = new Map();
  const seen = new Set();
  for (const row of assignments) {
    if (seen.has(row.participant_id)) throw new Error('Duplicate pool participant');
    seen.add(row.participant_id);
    if (!pools.has(row.pool_id)) pools.set(row.pool_id, { number: row.pool_no, ids: [] });
    pools.get(row.pool_id).ids.push(row.participant_id);
  }
  const schedules = [...pools.values()].map(({ number, ids }) => {
    const rotation = [...ids]; if (rotation.length % 2) rotation.push(null);
    const rounds = [];
    for (let r = 0; r < rotation.length - 1; r++) {
      const matches = [];
      for (let i = 0; i < rotation.length / 2; i++) {
        const a = rotation[i], b = rotation[rotation.length - 1 - i];
        if (a && b) matches.push({ pool_no: number, a, b });
      }
      rounds.push(matches);
      rotation.splice(1, 0, rotation.pop());
    }
    return rounds;
  });
  const result = [];
  for (let r = 0; r < Math.max(0, ...schedules.map((s) => s.length)); r++) for (const schedule of schedules) result.push(...(schedule[r] || []));
  return result;
}
module.exports = { buildPoolMatchSchedule };
