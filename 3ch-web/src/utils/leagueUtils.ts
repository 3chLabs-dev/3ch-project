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
