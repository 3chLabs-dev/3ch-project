export interface GroupOption {
  tierSize: number;
  groupCount: number;
  groups: number[];
  recommended: boolean;
  score: number;
}

const TIER_SIZES = [3, 4, 5];

export function generateGroupOptions(playerCount: number): GroupOption[] {
  const options: GroupOption[] = [];
  const uniqueGroupMap = new Map<string, GroupOption>();

  for (const tierSize of TIER_SIZES) {
    const groupCount = Math.ceil(playerCount / tierSize);

    const smallGroupCount = groupCount * tierSize - playerCount;
    const largeGroupCount = groupCount - smallGroupCount;

    const groups: number[] = [];

    // 큰 조 먼저 추가
    for (let i = 0; i < largeGroupCount; i++) {
      groups.push(tierSize);
    }

    // 작은 조 추가
    for (let i = 0; i < smallGroupCount; i++) {
      groups.push(tierSize - 1);
    }

    // 2인조 이하 방지
    const hasInvalidGroup = groups.some((size) => size < 3);

    if (hasInvalidGroup) {
      continue;
    }

    const score = calculateOptionScore(groups, tierSize);

    const option: GroupOption = {
  tierSize,
  groupCount,
  groups,
  score,
  recommended: false,
};

const key = groups.join('-');

const existing = uniqueGroupMap.get(key);

if (!existing || option.score > existing.score) {
  uniqueGroupMap.set(key, option);
}
  }

  // 점수순 정렬
  options.push(...uniqueGroupMap.values());
  options.sort((a, b) => b.score - a.score);

  // 최고 점수 추천 처리
  if (options.length > 0) {
    options[0].recommended = true;
  }

  return options;
}

function calculateOptionScore(
  groups: number[],
  tierSize: number
): number {
  let score = 100;

  const twoPlayerGroups = groups.filter((g) => g === 2).length;

  // 2인조 강한 패널티
  score -= twoPlayerGroups * 30;

  // 조 개수 너무 많으면 패널티
  score -= groups.length * 2;

  // 선호 티어 가중치
  switch (tierSize) {
    case 4:
      score += 10;
      break;

    case 5:
      score += 5;
      break;

    case 3:
      score += 3;
      break;
  }

  return score;
}