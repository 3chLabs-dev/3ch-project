import assert from "node:assert/strict";
import {
  buildCrossGroupTournamentSeedOrder,
  buildTournamentSlots,
} from "../src/utils/programMatchGenerator";

type Unit = {
  id: string | null;
  name: string | null;
  seedLabel?: string;
};

const referenceThreeByEight = [
  "1-1", null, "2-6", "3-6", "2-3", "1-8", null, "1-3",
  "3-2", null, "3-7", "1-5", "3-4", "2-7", null, "2-2",
  "2-1", null, "1-7", "3-5", "2-4", "3-8", null, "1-2",
  "3-3", null, "2-8", "1-4", "2-5", "1-6", null, "3-1",
];

let checked = 0;
// 참고 시스템이 제공하는 조별 진출 수(1~12명)와, 실사용 범위를
// 넉넉히 포함한 2~16개 조의 모든 조합을 검사한다.
for (let groupCount = 2; groupCount <= 16; groupCount += 1) {
  for (let advanceCount = 1; advanceCount <= 12; advanceCount += 1) {
    const pools: Unit[][] = Array.from({ length: groupCount }, (_, groupIndex) =>
      Array.from({ length: advanceCount }, (_, rankIndex) => ({
        id: `g${groupIndex + 1}-r${rankIndex + 1}`,
        name: `${groupIndex + 1}조 ${rankIndex + 1}위`,
      })),
    );
    const ordered = buildCrossGroupTournamentSeedOrder(pools);
    const slots = buildTournamentSlots(
      "validation",
      1,
      { tournamentSeeding: "seed" } as never,
      ordered,
      "seed",
    ) as Array<Unit | null>;
    const entrants = slots.filter((unit): unit is Unit => Boolean(unit?.id));
    const expectedCount = groupCount * advanceCount;
    const expectedBracketSize = 2 ** Math.ceil(Math.log2(Math.max(2, expectedCount)));

    assert.equal(slots.length, expectedBracketSize, `${groupCount}조×${advanceCount}명 bracket size`);
    assert.equal(entrants.length, expectedCount, `${groupCount}조×${advanceCount}명 entrant count`);
    assert.equal(new Set(entrants.map((unit) => unit.id)).size, expectedCount, `${groupCount}조×${advanceCount}명 duplicate`);
    entrants.forEach((unit) => {
      const match = /^g(\d+)-r(\d+)$/.exec(unit.id ?? "");
      assert.ok(match, `invalid id ${unit.id}`);
      assert.equal(unit.seedLabel, `${match[1]}-${match[2]}`, `${unit.id} seed label`);
    });

    for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 2) {
      const left = slots[slotIndex];
      const right = slots[slotIndex + 1];
      if (!left?.id || !right?.id) continue;
      assert.notEqual(left.id.split("-")[0], right.id.split("-")[0], `${groupCount}조×${advanceCount}명 same-group opener`);
    }

    if (groupCount === 3 && advanceCount === 8) {
      assert.deepEqual(slots.map((unit) => unit?.seedLabel ?? null), referenceThreeByEight);

      const poolsWithBots = pools.map((pool, poolIndex) =>
        pool.map((unit, rankIndex) =>
          rankIndex === 7 && (poolIndex === 1 || poolIndex === 2)
            ? { id: null, name: null }
            : unit
        )
      );
      const botOrdered = buildCrossGroupTournamentSeedOrder(poolsWithBots);
      const botSlots = buildTournamentSlots(
        "validation-bots",
        1,
        { tournamentSeeding: "seed" } as never,
        botOrdered,
        "seed",
      ) as Array<Unit | null>;
      const botExpected = referenceThreeByEight.map((label) =>
        label === "2-8" || label === "3-8" ? null : label
      );
      assert.deepEqual(botSlots.map((unit) => unit?.seedLabel ?? null), botExpected);
      assert.equal(botSlots.filter((unit) => !unit?.id).length, 10, "3조×8명 BOT 2명 BYE count");
    }
    checked += 1;
  }
}

console.log(`validated ${checked} tournament qualifier combinations`);
