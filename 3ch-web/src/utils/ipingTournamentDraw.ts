/**
 * 아이핑 공개 GameHelp와의 배치 호환 정책(2026-10-06 재확인).
 * 지원 비교 범위: 1~8개조는 조별 1~12명, 9~10개조는 1~10명.
 * 순위별 순환 시드 + 재귀 라인 + 확인된 시드 교환 보정.
 * 1~8개조는 시드 보정, 9~10개조는 확인된 슬롯 표를 사용한다. 테스트 fixture는 읽지 않는다.
 * 이 결정적 순서는 아이핑 고유 정책이지 ITTF가 정한 유일한 배열이 아니다.
 */
const compatibilitySwaps: Readonly<Record<string, readonly (readonly [number, number])[]>> = {
  "1:4": [[1,2]],
  "2:3": [[1,6],[3,4]],
  "3:2": [[3,4]],
  "3:3": [[6,7]],
  "3:4": [[6,7],[9,11]],
  "3:5": [[6,7],[9,11],[12,13]],
  "3:6": [[1,2],[10,11],[12,14],[16,17]],
  "3:7": [[1,2],[11,14],[12,14],[16,17]],
  "3:8": [[1,2],[11,14],[12,14],[16,17],[21,22]],
  "3:9": [[1,2],[11,14],[12,14],[16,17],[21,22]],
  "4:2": [[2,6],[3,7],[4,6],[5,7]],
  "4:3": [[8,10],[9,11]],
  "4:4": [[4,6],[5,7],[8,10],[9,11]],
  "4:5": [[4,6],[5,7],[16,18],[17,19]],
  "4:6": [[4,6],[5,7],[16,18],[17,19]],
  "4:7": [[1,3],[9,11],[16,18],[20,22],[21,23],[24,26]],
  "4:8": [[1,3],[8,10],[9,11],[16,18],[20,22],[21,23],[28,30],[29,31]],
  "5:2": [[7,9]],
  "5:3": [[5,7],[12,14]],
  "5:4": [[6,7],[12,14],[15,19],[16,18],[17,19]],
  "5:5": [[1,15],[2,15],[3,19],[4,15],[5,18],[6,19],[7,17],[8,15],[9,20],[10,17],[11,24],[12,15],[13,23],[14,20],[15,22],[16,18],[17,21],[18,19],[19,25],[21,26],[22,26],[23,27],[25,28],[27,29],[28,29],[29,30]],
  "5:6": [[5,7],[6,8],[10,11],[11,12],[16,18],[17,19],[18,19],[25,27],[28,29]],
  "5:7": [[1,3],[5,7],[17,19],[20,22],[22,24],[26,27],[30,32],[32,34]],
  "6:2": [[6,10],[7,11],[8,11],[9,10]],
  "7:2": [[7,12],[8,12],[9,13]],
  "7:5": [[31,33]],
  "7:6": [[29,31],[33,41]],
  "7:7": [[29,31],[39,41],[45,47]],
  "7:8": [[1,4],[8,10],[14,16],[22,27],[29,31]],
  "8:2": [[8,12],[9,13]],
  "8:5": [[32,39],[33,38],[34,37],[35,36]],
  "8:6": [[9,11],[12,14],[13,15],[32,34],[33,35],[36,38],[37,39],[40,42]],
  "8:7": [[5,7],[13,15],[16,18],[28,30],[29,31],[32,34],[33,35],[36,38],[40,42],[41,43],[44,46],[49,51],[52,54],[53,55]],
  "8:8": [[5,7],[13,15],[16,18],[28,30],[29,31],[32,34],[33,35],[36,38],[40,42],[41,43],[44,46],[49,51],[52,54],[53,55],[56,58],[57,59]],
};

// 사용자 제공 캡처: 좌측 위→아래, 이어 우측 위→아래. 제공되지 않는 11~12명은 제외.
const nineGroupSlots: Readonly<Record<number, string>> = {
  1: '1-1 BYE 8-1 BYE 3-1 BYE 6-1 BYE 2-1 BYE 7-1 BYE 4-1 BYE 5-1 9-1',
  2: '1-1 BYE 2-2 7-2 9-1 BYE BYE 8-1 5-1 BYE BYE 6-2 3-2 BYE BYE 4-1 3-1 BYE BYE 4-2 5-2 BYE BYE 6-1 7-1 BYE BYE 8-2 9-2 1-2 BYE 2-1',
  3: '1-1 BYE 2-2 6-2 9-1 3-3 4-3 8-1 5-1 BYE 9-3 1-2 7-2 8-3 BYE 4-1 3-1 BYE 7-3 8-2 5-2 1-3 6-3 7-1 6-1 5-3 2-3 4-2 9-2 3-2 BYE 2-1',
  4: '1-1 BYE 6-4 5-4 2-2 BYE BYE 7-2 9-1 BYE BYE 3-3 4-3 BYE BYE 8-1 5-1 BYE BYE 1-4 9-3 BYE BYE 6-2 1-2 BYE BYE 8-3 3-4 9-4 BYE 4-1 3-1 BYE 4-4 2-4 6-3 BYE BYE 8-2 5-2 BYE BYE 1-3 7-3 BYE BYE 6-1 7-1 BYE BYE 5-3 2-3 BYE BYE 4-2 9-2 BYE BYE 3-2 8-4 7-4 BYE 2-1',
  5: '1-1 BYE 6-4 5-4 2-2 BYE BYE 1-2 9-1 BYE 8-5 3-3 4-3 7-5 BYE 5-1 8-1 BYE 4-5 1-4 9-3 2-5 BYE 6-2 7-2 BYE 3-5 8-3 2-4 9-4 BYE 4-1 3-1 BYE 8-4 2-3 6-3 BYE BYE 8-2 5-2 BYE 1-5 3-4 7-3 5-5 BYE 6-1 7-1 BYE 6-5 5-3 1-3 9-5 BYE 4-2 9-2 BYE BYE 3-2 4-4 7-4 BYE 2-1',
  6: '1-1 BYE 8-4 3-4 7-3 9-6 1-6 8-2 5-2 6-6 8-5 1-3 6-3 5-5 BYE 8-1 7-1 BYE 6-5 5-3 2-3 9-5 BYE 4-2 9-2 2-6 8-6 3-2 4-4 7-4 BYE 2-1 3-1 BYE 6-4 5-4 2-2 7-6 3-6 1-2 9-1 BYE 1-5 3-3 4-3 7-5 BYE 6-1 5-1 BYE 4-5 1-4 9-3 2-5 5-6 6-2 7-2 4-6 3-5 8-3 2-4 9-4 BYE 4-1',
  7: '1-1 BYE 8-4 3-4 2-2 7-6 3-6 1-2 9-1 2-7 1-5 6-3 4-3 5-5 3-7 8-1 5-1 6-7 4-5 1-4 9-3 2-5 5-6 6-2 7-2 4-6 3-5 8-3 2-4 9-4 7-7 4-1 3-1 8-7 6-4 5-4 7-3 9-6 1-6 8-2 5-2 6-6 8-5 1-3 3-3 7-5 5-7 6-1 7-1 4-7 6-5 5-3 2-3 9-5 1-7 4-2 9-2 2-6 8-6 3-2 4-4 7-4 9-7 2-1',
  8: '1-1 BYE 5-8 4-8 8-4 BYE BYE 5-4 2-2 BYE BYE 7-6 1-6 BYE BYE 8-2 9-1 BYE BYE 2-7 1-5 BYE BYE 3-3 4-3 BYE BYE 7-5 5-7 3-8 BYE 8-1 5-1 BYE 9-8 6-7 4-5 BYE BYE 1-4 9-3 BYE BYE 2-5 5-6 BYE BYE 6-2 7-2 BYE BYE 4-6 3-5 BYE BYE 8-3 2-4 BYE BYE 9-4 7-7 8-8 BYE 4-1 3-1 BYE 7-8 8-7 6-4 BYE BYE 3-4 7-3 BYE BYE 9-6 3-6 BYE BYE 1-2 5-2 BYE BYE 6-6 8-5 BYE BYE 1-3 6-3 BYE BYE 5-5 3-7 1-8 BYE 6-1 7-1 BYE 2-8 4-7 6-5 BYE BYE 5-3 2-3 BYE BYE 9-5 1-7 BYE BYE 4-2 9-2 BYE BYE 2-6 8-6 BYE BYE 3-2 4-4 BYE BYE 7-4 9-7 6-8 BYE 2-1',
  9: '1-1 BYE 5-8 4-8 6-4 BYE BYE 5-4 2-2 BYE 6-9 9-6 1-6 5-9 BYE 1-2 9-1 BYE 7-9 2-7 8-5 BYE BYE 3-3 4-3 BYE BYE 7-5 3-7 3-8 BYE 8-1 5-1 BYE 9-8 6-7 4-5 BYE BYE 1-4 9-3 BYE BYE 2-5 5-6 1-9 BYE 6-2 7-2 BYE 2-9 4-6 3-5 BYE BYE 8-3 2-4 BYE BYE 9-4 7-7 8-8 BYE 4-1 3-1 BYE 7-8 8-7 8-4 BYE BYE 3-4 7-3 BYE BYE 7-6 3-6 3-9 BYE 8-2 5-2 BYE 9-9 6-6 1-5 BYE BYE 1-3 6-3 BYE BYE 5-5 5-7 1-8 BYE 6-1 7-1 BYE 2-8 4-7 6-5 BYE BYE 5-3 2-3 BYE BYE 9-5 1-7 8-9 BYE 4-2 9-2 BYE 4-9 2-6 8-6 BYE BYE 3-2 4-4 BYE BYE 7-4 9-7 6-8 BYE 2-1',
  10: '1-1 BYE 5-8 4-8 6-4 BYE BYE 5-4 2-2 BYE 6-9 9-6 1-6 5-9 BYE 1-2 9-1 BYE 7-9 2-7 8-5 7-10 BYE 3-3 4-3 BYE 8-10 7-5 3-7 3-8 BYE 8-1 5-1 BYE 9-8 6-7 4-5 BYE BYE 1-4 9-3 BYE 4-10 2-5 5-6 1-9 BYE 6-2 7-2 BYE 2-9 4-6 3-5 3-10 BYE 8-3 2-4 BYE BYE 9-4 7-7 8-8 BYE 4-1 3-1 BYE 7-8 8-7 8-4 BYE BYE 3-4 7-3 BYE 2-10 7-6 3-6 3-9 BYE 8-2 5-2 BYE 9-9 6-6 1-5 5-10 BYE 1-3 6-3 BYE BYE 5-5 5-7 1-8 BYE 6-1 7-1 BYE 2-8 4-7 6-5 9-10 BYE 5-3 2-3 BYE 6-10 9-5 1-7 8-9 BYE 4-2 9-2 BYE 4-9 2-6 8-6 1-10 BYE 3-2 4-4 BYE BYE 7-4 9-7 6-8 BYE 2-1',
};

// 10개조는 현재 제공된 1~10명 캡처를 호환 배치로 지원한다.
const tenGroupSlots: Readonly<Record<number, string>> = {
  7: '1-1 BYE 5-7 4-7 3-4 BYE BYE 2-4 7-2 BYE BYE 8-5 9-5 BYE BYE 6-2 9-1 BYE BYE 6-6 1-5 BYE BYE 4-3 5-3 BYE BYE 10-4 7-6 BYE BYE 8-1 5-1 BYE 9-7 10-6 7-4 BYE BYE 8-3 1-3 BYE BYE 4-5 3-6 BYE BYE 2-2 3-2 BYE BYE 2-6 5-5 BYE BYE 10-2 9-3 BYE BYE 6-4 1-7 8-7 BYE 4-1 3-1 BYE 7-7 2-7 5-4 BYE BYE 10-3 9-2 BYE BYE 6-5 1-6 BYE BYE 4-2 1-2 BYE BYE 4-6 3-5 BYE BYE 2-3 7-3 BYE BYE 8-4 9-6 10-7 BYE 6-1 7-1 BYE BYE 8-6 9-4 BYE BYE 6-3 3-3 BYE BYE 2-5 5-6 BYE BYE 10-1 5-2 BYE BYE 10-5 7-5 BYE BYE 8-2 1-4 BYE BYE 4-4 3-7 6-7 BYE 2-1',
  8: '1-1 BYE 5-7 4-7 3-4 BYE BYE 2-4 7-2 BYE BYE 8-5 9-5 10-8 BYE 6-2 9-1 BYE 3-8 6-6 1-5 BYE BYE 4-3 5-3 BYE BYE 10-4 7-6 2-8 BYE 8-1 5-1 BYE 9-7 10-6 7-4 BYE BYE 8-3 1-3 BYE BYE 4-5 3-6 6-8 BYE 2-2 3-2 BYE 7-8 2-6 5-5 BYE BYE 10-2 9-3 BYE BYE 6-4 1-7 8-7 BYE 4-1 3-1 BYE 7-7 2-7 5-4 BYE BYE 10-3 9-2 BYE BYE 6-5 1-6 8-8 BYE 4-2 1-2 BYE 5-8 4-6 3-5 BYE BYE 2-3 7-3 BYE BYE 8-4 9-6 10-7 BYE 6-1 7-1 BYE 1-8 8-6 9-4 BYE BYE 6-3 3-3 BYE BYE 2-5 5-6 4-8 BYE 10-1 5-2 BYE 9-8 10-5 7-5 BYE BYE 8-2 1-4 BYE BYE 4-4 3-7 6-7 BYE 2-1',
  9: '1-1 BYE 5-7 4-7 3-4 BYE BYE 2-4 7-2 BYE 1-9 8-5 9-5 10-8 BYE 6-2 9-1 BYE 3-8 6-6 1-5 8-9 BYE 4-3 5-3 BYE 9-9 10-4 7-6 2-8 BYE 8-1 5-1 BYE 9-7 10-6 7-4 BYE BYE 8-3 1-3 BYE 5-9 4-5 3-6 6-8 BYE 2-2 3-2 BYE 7-8 2-6 5-5 4-9 BYE 10-2 9-3 BYE BYE 6-4 1-7 8-7 BYE 4-1 3-1 BYE 7-7 2-7 5-4 BYE BYE 10-3 9-2 BYE 3-9 6-5 1-6 8-8 BYE 4-2 1-2 BYE 5-8 4-6 3-5 6-9 BYE 2-3 7-3 BYE BYE 8-4 9-6 10-7 BYE 6-1 7-1 BYE 1-8 8-6 9-4 10-9 BYE 6-3 3-3 BYE 7-9 2-5 5-6 4-8 BYE 10-1 5-2 BYE 9-8 10-5 7-5 2-9 BYE 8-2 1-4 BYE BYE 4-4 3-7 6-7 BYE 2-1',
  10: '1-1 BYE 5-7 4-7 3-4 6-10 7-10 2-4 7-2 BYE 1-9 8-5 9-5 10-8 BYE 6-2 9-1 BYE 3-8 6-6 1-5 8-9 BYE 4-3 5-3 BYE 9-9 10-4 7-6 2-8 BYE 8-1 5-1 BYE 9-7 10-6 7-4 2-10 BYE 8-3 1-3 BYE 5-9 4-5 3-6 6-8 BYE 2-2 3-2 BYE 7-8 2-6 5-5 4-9 BYE 10-2 9-3 10-10 3-10 6-4 1-7 8-7 BYE 4-1 3-1 BYE 7-7 2-7 5-4 4-10 9-10 10-3 9-2 BYE 3-9 6-5 1-6 8-8 BYE 4-2 1-2 BYE 5-8 4-6 3-5 6-9 BYE 2-3 7-3 BYE 1-10 8-4 9-6 10-7 BYE 6-1 7-1 BYE 1-8 8-6 9-4 10-9 BYE 6-3 3-3 BYE 7-9 2-5 5-6 4-8 BYE 10-1 5-2 BYE 9-8 10-5 7-5 2-9 BYE 8-2 1-4 8-10 5-10 4-4 3-7 6-7 BYE 2-1',
  1: '1-1 BYE 8-1 BYE 3-1 BYE 6-1 10-1 2-1 BYE 7-1 BYE 4-1 BYE 5-1 9-1',
  2: '1-1 BYE 2-2 10-2 9-1 BYE BYE 8-1 5-1 BYE BYE 7-2 6-2 3-2 BYE 4-1 3-1 BYE 4-2 5-2 8-2 BYE BYE 6-1 7-1 BYE BYE 10-1 9-2 1-2 BYE 2-1',
  3: '1-1 BYE 7-2 6-2 9-1 4-3 5-3 8-1 5-1 8-3 1-3 2-2 3-2 10-2 9-3 4-1 3-1 10-3 9-2 4-2 1-2 2-3 7-3 6-1 7-1 6-3 3-3 10-1 5-2 8-2 BYE 2-1',
  4: '1-1 BYE 3-4 2-4 7-2 BYE BYE 6-2 9-1 BYE BYE 4-3 5-3 10-4 BYE 8-1 5-1 BYE 7-4 8-3 1-3 BYE BYE 2-2 3-2 BYE BYE 10-2 9-3 6-4 BYE 4-1 3-1 BYE 5-4 10-3 9-2 BYE BYE 4-2 1-2 BYE BYE 2-3 7-3 8-4 BYE 6-1 7-1 BYE 9-4 6-3 3-3 BYE BYE 10-1 5-2 BYE BYE 8-2 1-4 4-4 BYE 2-1',
  5: '1-1 BYE 3-4 2-4 7-2 8-5 9-5 6-2 9-1 BYE 1-5 4-3 5-3 10-4 BYE 8-1 5-1 BYE 7-4 8-3 1-3 4-5 BYE 2-2 3-2 BYE 5-5 10-2 9-3 6-4 BYE 4-1 3-1 BYE 5-4 10-3 9-2 6-5 BYE 4-2 1-2 BYE 3-5 2-3 7-3 8-4 BYE 6-1 7-1 BYE 9-4 6-3 3-3 2-5 BYE 10-1 5-2 10-5 7-5 8-2 1-4 4-4 BYE 2-1',
  6: '1-1 BYE 3-4 2-4 7-2 8-5 9-5 6-2 9-1 6-6 1-5 4-3 5-3 10-4 7-6 8-1 5-1 10-6 7-4 8-3 1-3 4-5 3-6 2-2 3-2 2-6 5-5 10-2 9-3 6-4 BYE 4-1 3-1 BYE 5-4 10-3 9-2 6-5 1-6 4-2 1-2 4-6 3-5 2-3 7-3 8-4 9-6 6-1 7-1 8-6 9-4 6-3 3-3 2-5 5-6 10-1 5-2 10-5 7-5 8-2 1-4 4-4 BYE 2-1',
};

function lineSeeds(size: number): number[] {
  if (size === 2) return [1, 2];
  return lineSeeds(size / 2).flatMap((seed, index) =>
    index % 2 === 0 ? [seed, size + 1 - seed] : [size + 1 - seed, seed]);
}

// 조별 1명 배치는 GameHelp의 별도 단일 순위 라인 방향을 사용한다.
function singleRankLines(size: number): number[] {
  const reverseBits = (count: number): number[] => {
    if (count === 1) return [0];
    const previous = reverseBits(count / 2);
    return [...previous.map(value => value * 2), ...previous.map(value => value * 2 + 1)];
  };
  return reverseBits(size / 2).flatMap(value => [value + 1, size - value]);
}

/** 공개 페이지의 원본 슬롯 라벨. 좌측 위→아래, 이어 우측 위→아래. */
export function buildIpingSlotLabels(groupCount: number, qualifiersPerGroup: number): string[] | null {
  if (!Number.isInteger(groupCount) || !Number.isInteger(qualifiersPerGroup)
    || groupCount < 1 || groupCount > 10 || qualifiersPerGroup < 1 || qualifiersPerGroup > 12) {
    return null;
  }
  if (groupCount === 9) return nineGroupSlots[qualifiersPerGroup]?.split(' ') ?? null;
  if (groupCount === 10) return tenGroupSlots[qualifiersPerGroup]?.split(' ') ?? null;
  // 원본 페이지의 두 퇴화 입력도 그대로 기록한다. 실제 선수 적용 시에는
  // 이 라벨을 참가자 목록과 대조하므로 없는 선수를 생성하지 않는다.
  if (groupCount === 1 && qualifiersPerGroup === 1) return [];
  if (groupCount === 2 && qualifiersPerGroup === 1) return ["1-1", "2-2", "2-1", "1-2"];
  if (groupCount === 4 && qualifiersPerGroup === 1) return ["1-1", "3-1", "2-1", "4-1"];

  const total = groupCount * qualifiersPerGroup;
  const bracketSize = groupCount === 1 && qualifiersPerGroup === 2
    ? 4 : 2 ** Math.ceil(Math.log2(Math.max(2, total)));
  if (qualifiersPerGroup === 1) {
    return singleRankLines(bracketSize).map(seed => seed <= groupCount ? `${seed}-1` : "BYE");
  }
  const stride = (groupCount + 2) % 4;
  const seeds = Array.from({ length: qualifiersPerGroup }, (_, rankIndex) =>
    Array.from({ length: groupCount }, (_, groupOffset) =>
      `${(groupOffset + rankIndex * stride) % groupCount + 1}-${rankIndex + 1}`)).flat();
  while (seeds.length < bracketSize) seeds.push("BYE");
  for (const [left, right] of compatibilitySwaps[`${groupCount}:${qualifiersPerGroup}`] ?? []) {
    [seeds[left], seeds[right]] = [seeds[right], seeds[left]];
  }
  return lineSeeds(bracketSize).map(seed => seeds[seed - 1]);
}
