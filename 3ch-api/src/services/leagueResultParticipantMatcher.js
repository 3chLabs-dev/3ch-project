const normalizeName = (name) => String(name || '').normalize('NFKC').replace(/\s+/g, '').toLocaleLowerCase('ko-KR');

function matchResultParticipant(participant, candidates) {
  const recognizedName = normalizeName(participant.name);
  if (!recognizedName) return { ...participant };
  const matches = candidates.filter((candidate) => [
    candidate.name, candidate.nickname, candidate.canonical_name, candidate.external_alias,
    ...(Array.isArray(candidate.external_aliases) ? candidate.external_aliases : []),
  ].some((name) => normalizeName(name) === recognizedName));
  const unique = [...new Map(matches.map((candidate) => [
    `${candidate.group_id}:${candidate.member_id ? `member:${candidate.member_id}` : `pre:${candidate.pre_member_id}`}`,
    candidate,
  ])).values()];
  if (unique.length !== 1) return { ...participant, needsReview: participant.needsReview || unique.length > 1 };
  const match = unique[0];
  return {
    ...participant,
    member_id: match.member_id ?? null,
    pre_member_id: match.pre_member_id ?? null,
    source_group_id: match.group_id,
    canonical_name: match.canonical_name || match.name,
    name: match.canonical_name || match.name,
    division: String(participant.division || '').trim() || String(match.division ?? ''),
  };
}

module.exports = { matchResultParticipant };
