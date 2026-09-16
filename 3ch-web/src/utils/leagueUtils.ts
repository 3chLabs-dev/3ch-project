// 라운드로빈 경기 순서 생성
// n명 → [positionA, positionB] 쌍 배열 (0-indexed)
// 예) 4명 → (0,3),(1,2),(0,2),(1,3),(0,1),(2,3)
export function generateRoundRobin(n: number): Array<[number, number]> {
  const games: Array<[number, number]> = [];
  const size = n % 2 === 0 ? n : n + 1;
  const pos = Array.from({ length: size }, (_, i) => i);

  for (let round = 0; round < size - 1; round++) {
    for (let i = 0; i < size / 2; i++) {
      const p1 = pos[i];
      const p2 = pos[size - 1 - i];
      if (p1 < n && p2 < n) games.push([p1, p2]);
    }
    const last = pos.splice(size - 1, 1)[0];
    pos.splice(1, 0, last);
  }
  return games;
}

/**
 * 저장된 경기/결과는 그대로 둔 채 화면의 경기 순서만 현재 참가자 순서에
 * 맞는 표준 라운드로빈 순서로 정렬한다.
 */
export function sortRoundRobinMatches<T extends {
  participant_a_id: string | null;
  participant_b_id: string | null;
}>(matches: T[], participantIds: string[]): T[] {
  const pairKey = (left: string, right: string) => [left, right].sort().join("|");
  const orderByPair = new Map(
    generateRoundRobin(participantIds.length).map(([leftIndex, rightIndex], index) => [
      pairKey(participantIds[leftIndex], participantIds[rightIndex]),
      index,
    ]),
  );

  return matches
    .map((match, originalIndex) => ({ match, originalIndex }))
    .sort((left, right) => {
      const leftOrder = left.match.participant_a_id && left.match.participant_b_id
        ? orderByPair.get(pairKey(left.match.participant_a_id, left.match.participant_b_id))
        : undefined;
      const rightOrder = right.match.participant_a_id && right.match.participant_b_id
        ? orderByPair.get(pairKey(right.match.participant_a_id, right.match.participant_b_id))
        : undefined;
      return (leftOrder ?? Number.MAX_SAFE_INTEGER) - (rightOrder ?? Number.MAX_SAFE_INTEGER)
        || left.originalIndex - right.originalIndex;
    })
    .map(({ match }) => match);
}
