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

    // A single-size adjustment cannot represent this participant count.
    // Without this guard (for example 7 people with a tier size of 5), the
    // negative large-group count produced impossible structures such as 4/4/4.
    if (largeGroupCount < 0 || smallGroupCount > groupCount) {
      continue;
    }

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
    const hasInvalidGroup = groups.some((size) => size < 3)
      || groups.reduce((sum, size) => sum + size, 0) !== playerCount;

    if (hasInvalidGroup) {
      continue;
    }

    const score = calculateOptionScore(groups, tierSize);

  const option: GroupOption = {
  tierSize,
  // The rendered structure is the source of truth (and protects callers
  // from displaying a stale calculated count after the player count changes).
  groupCount: groups.length,
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
