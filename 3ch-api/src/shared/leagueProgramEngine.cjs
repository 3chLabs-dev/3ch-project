// Generated from the actual league algorithms. Rebuild: node 3ch-web/scripts/buildTournamentEngine.mjs
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// <stdin>
var stdin_exports = {};
__export(stdin_exports, {
  applyProgramTournamentAdvancement: () => applyProgramTournamentAdvancement,
  generateProgramBlocks: () => generateProgramBlocks,
  generateProgramRoundMatches: () => generateProgramRoundMatches
});
module.exports = __toCommonJS(stdin_exports);

// 3ch-web/src/features/league/algorithms/distributeSnake.ts
function distributeSnake(players, groupSizes) {
  const groupCount = groupSizes.length;
  if (groupCount === 0) return [];
  const groups = groupSizes.map((_, index) => ({
    name: `${index + 1}\uC870`,
    players: []
  }));
  const tiers = [];
  for (let i = 0; i < players.length; i += groupCount) {
    tiers.push(players.slice(i, i + groupCount));
  }
  let reverse = false;
  tiers.forEach((tier) => {
    const currentTier = reverse ? [...tier].reverse() : tier;
    currentTier.forEach((player, index) => {
      const groupIndex = index;
      if (groups[groupIndex] && groups[groupIndex].players.length < groupSizes[groupIndex]) {
        groups[groupIndex].players.push(player);
      }
    });
    reverse = !reverse;
  });
  return groups;
}

// 3ch-web/src/utils/roundRobinStandings.ts
function getRoundRobinWinScore(rule) {
  if (rule === "BEST_OF_5" || rule === "5\uC804 3\uC120\uC2B9\uC81C") return 3;
  if (rule === "BEST_OF_3" || rule === "3\uC804 2\uC120\uC2B9\uC81C") return 2;
  return null;
}

// 3ch-web/src/utils/leagueUtils.ts
function generateRoundRobin(n) {
  const games = [];
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

// 3ch-web/src/utils/ipingTournamentDraw.ts
var compatibilitySwaps = {
  "1:4": [[1, 2]],
  "2:3": [[1, 6], [3, 4]],
  "3:2": [[3, 4]],
  "3:3": [[6, 7]],
  "3:4": [[6, 7], [9, 11]],
  "3:5": [[6, 7], [9, 11], [12, 13]],
  "3:6": [[1, 2], [10, 11], [12, 14], [16, 17]],
  "3:7": [[1, 2], [11, 14], [12, 14], [16, 17]],
  "3:8": [[1, 2], [11, 14], [12, 14], [16, 17], [21, 22]],
  "3:9": [[1, 2], [11, 14], [12, 14], [16, 17], [21, 22]],
  "4:2": [[2, 6], [3, 7], [4, 6], [5, 7]],
  "4:3": [[8, 10], [9, 11]],
  "4:4": [[4, 6], [5, 7], [8, 10], [9, 11]],
  "4:5": [[4, 6], [5, 7], [16, 18], [17, 19]],
  "4:6": [[4, 6], [5, 7], [16, 18], [17, 19]],
  "4:7": [[1, 3], [9, 11], [16, 18], [20, 22], [21, 23], [24, 26]],
  "4:8": [[1, 3], [8, 10], [9, 11], [16, 18], [20, 22], [21, 23], [28, 30], [29, 31]],
  "5:2": [[7, 9]],
  "5:3": [[5, 7], [12, 14]],
  "5:4": [[6, 7], [12, 14], [15, 19], [16, 18], [17, 19]],
  "5:5": [[1, 15], [2, 15], [3, 19], [4, 15], [5, 18], [6, 19], [7, 17], [8, 15], [9, 20], [10, 17], [11, 24], [12, 15], [13, 23], [14, 20], [15, 22], [16, 18], [17, 21], [18, 19], [19, 25], [21, 26], [22, 26], [23, 27], [25, 28], [27, 29], [28, 29], [29, 30]],
  "5:6": [[5, 7], [6, 8], [10, 11], [11, 12], [16, 18], [17, 19], [18, 19], [25, 27], [28, 29]],
  "5:7": [[1, 3], [5, 7], [17, 19], [20, 22], [22, 24], [26, 27], [30, 32], [32, 34]],
  "6:2": [[6, 10], [7, 11], [8, 11], [9, 10]],
  "7:2": [[7, 12], [8, 12], [9, 13]],
  "7:5": [[31, 33]],
  "7:6": [[29, 31], [33, 41]],
  "7:7": [[29, 31], [39, 41], [45, 47]],
  "7:8": [[1, 4], [8, 10], [14, 16], [22, 27], [29, 31]],
  "8:2": [[8, 12], [9, 13]],
  "8:5": [[32, 39], [33, 38], [34, 37], [35, 36]],
  "8:6": [[9, 11], [12, 14], [13, 15], [32, 34], [33, 35], [36, 38], [37, 39], [40, 42]],
  "8:7": [[5, 7], [13, 15], [16, 18], [28, 30], [29, 31], [32, 34], [33, 35], [36, 38], [40, 42], [41, 43], [44, 46], [49, 51], [52, 54], [53, 55]],
  "8:8": [[5, 7], [13, 15], [16, 18], [28, 30], [29, 31], [32, 34], [33, 35], [36, 38], [40, 42], [41, 43], [44, 46], [49, 51], [52, 54], [53, 55], [56, 58], [57, 59]]
};
var nineGroupSlots = {
  1: "1-1 BYE 8-1 BYE 3-1 BYE 6-1 BYE 2-1 BYE 7-1 BYE 4-1 BYE 5-1 9-1",
  2: "1-1 BYE 2-2 7-2 9-1 BYE BYE 8-1 5-1 BYE BYE 6-2 3-2 BYE BYE 4-1 3-1 BYE BYE 4-2 5-2 BYE BYE 6-1 7-1 BYE BYE 8-2 9-2 1-2 BYE 2-1",
  3: "1-1 BYE 2-2 6-2 9-1 3-3 4-3 8-1 5-1 BYE 9-3 1-2 7-2 8-3 BYE 4-1 3-1 BYE 7-3 8-2 5-2 1-3 6-3 7-1 6-1 5-3 2-3 4-2 9-2 3-2 BYE 2-1",
  4: "1-1 BYE 6-4 5-4 2-2 BYE BYE 7-2 9-1 BYE BYE 3-3 4-3 BYE BYE 8-1 5-1 BYE BYE 1-4 9-3 BYE BYE 6-2 1-2 BYE BYE 8-3 3-4 9-4 BYE 4-1 3-1 BYE 4-4 2-4 6-3 BYE BYE 8-2 5-2 BYE BYE 1-3 7-3 BYE BYE 6-1 7-1 BYE BYE 5-3 2-3 BYE BYE 4-2 9-2 BYE BYE 3-2 8-4 7-4 BYE 2-1",
  5: "1-1 BYE 6-4 5-4 2-2 BYE BYE 1-2 9-1 BYE 8-5 3-3 4-3 7-5 BYE 5-1 8-1 BYE 4-5 1-4 9-3 2-5 BYE 6-2 7-2 BYE 3-5 8-3 2-4 9-4 BYE 4-1 3-1 BYE 8-4 2-3 6-3 BYE BYE 8-2 5-2 BYE 1-5 3-4 7-3 5-5 BYE 6-1 7-1 BYE 6-5 5-3 1-3 9-5 BYE 4-2 9-2 BYE BYE 3-2 4-4 7-4 BYE 2-1",
  6: "1-1 BYE 8-4 3-4 7-3 9-6 1-6 8-2 5-2 6-6 8-5 1-3 6-3 5-5 BYE 8-1 7-1 BYE 6-5 5-3 2-3 9-5 BYE 4-2 9-2 2-6 8-6 3-2 4-4 7-4 BYE 2-1 3-1 BYE 6-4 5-4 2-2 7-6 3-6 1-2 9-1 BYE 1-5 3-3 4-3 7-5 BYE 6-1 5-1 BYE 4-5 1-4 9-3 2-5 5-6 6-2 7-2 4-6 3-5 8-3 2-4 9-4 BYE 4-1",
  7: "1-1 BYE 8-4 3-4 2-2 7-6 3-6 1-2 9-1 2-7 1-5 6-3 4-3 5-5 3-7 8-1 5-1 6-7 4-5 1-4 9-3 2-5 5-6 6-2 7-2 4-6 3-5 8-3 2-4 9-4 7-7 4-1 3-1 8-7 6-4 5-4 7-3 9-6 1-6 8-2 5-2 6-6 8-5 1-3 3-3 7-5 5-7 6-1 7-1 4-7 6-5 5-3 2-3 9-5 1-7 4-2 9-2 2-6 8-6 3-2 4-4 7-4 9-7 2-1",
  8: "1-1 BYE 5-8 4-8 8-4 BYE BYE 5-4 2-2 BYE BYE 7-6 1-6 BYE BYE 8-2 9-1 BYE BYE 2-7 1-5 BYE BYE 3-3 4-3 BYE BYE 7-5 5-7 3-8 BYE 8-1 5-1 BYE 9-8 6-7 4-5 BYE BYE 1-4 9-3 BYE BYE 2-5 5-6 BYE BYE 6-2 7-2 BYE BYE 4-6 3-5 BYE BYE 8-3 2-4 BYE BYE 9-4 7-7 8-8 BYE 4-1 3-1 BYE 7-8 8-7 6-4 BYE BYE 3-4 7-3 BYE BYE 9-6 3-6 BYE BYE 1-2 5-2 BYE BYE 6-6 8-5 BYE BYE 1-3 6-3 BYE BYE 5-5 3-7 1-8 BYE 6-1 7-1 BYE 2-8 4-7 6-5 BYE BYE 5-3 2-3 BYE BYE 9-5 1-7 BYE BYE 4-2 9-2 BYE BYE 2-6 8-6 BYE BYE 3-2 4-4 BYE BYE 7-4 9-7 6-8 BYE 2-1",
  9: "1-1 BYE 5-8 4-8 6-4 BYE BYE 5-4 2-2 BYE 6-9 9-6 1-6 5-9 BYE 1-2 9-1 BYE 7-9 2-7 8-5 BYE BYE 3-3 4-3 BYE BYE 7-5 3-7 3-8 BYE 8-1 5-1 BYE 9-8 6-7 4-5 BYE BYE 1-4 9-3 BYE BYE 2-5 5-6 1-9 BYE 6-2 7-2 BYE 2-9 4-6 3-5 BYE BYE 8-3 2-4 BYE BYE 9-4 7-7 8-8 BYE 4-1 3-1 BYE 7-8 8-7 8-4 BYE BYE 3-4 7-3 BYE BYE 7-6 3-6 3-9 BYE 8-2 5-2 BYE 9-9 6-6 1-5 BYE BYE 1-3 6-3 BYE BYE 5-5 5-7 1-8 BYE 6-1 7-1 BYE 2-8 4-7 6-5 BYE BYE 5-3 2-3 BYE BYE 9-5 1-7 8-9 BYE 4-2 9-2 BYE 4-9 2-6 8-6 BYE BYE 3-2 4-4 BYE BYE 7-4 9-7 6-8 BYE 2-1",
  10: "1-1 BYE 5-8 4-8 6-4 BYE BYE 5-4 2-2 BYE 6-9 9-6 1-6 5-9 BYE 1-2 9-1 BYE 7-9 2-7 8-5 7-10 BYE 3-3 4-3 BYE 8-10 7-5 3-7 3-8 BYE 8-1 5-1 BYE 9-8 6-7 4-5 BYE BYE 1-4 9-3 BYE 4-10 2-5 5-6 1-9 BYE 6-2 7-2 BYE 2-9 4-6 3-5 3-10 BYE 8-3 2-4 BYE BYE 9-4 7-7 8-8 BYE 4-1 3-1 BYE 7-8 8-7 8-4 BYE BYE 3-4 7-3 BYE 2-10 7-6 3-6 3-9 BYE 8-2 5-2 BYE 9-9 6-6 1-5 5-10 BYE 1-3 6-3 BYE BYE 5-5 5-7 1-8 BYE 6-1 7-1 BYE 2-8 4-7 6-5 9-10 BYE 5-3 2-3 BYE 6-10 9-5 1-7 8-9 BYE 4-2 9-2 BYE 4-9 2-6 8-6 1-10 BYE 3-2 4-4 BYE BYE 7-4 9-7 6-8 BYE 2-1"
};
var tenGroupSlots = {
  7: "1-1 BYE 5-7 4-7 3-4 BYE BYE 2-4 7-2 BYE BYE 8-5 9-5 BYE BYE 6-2 9-1 BYE BYE 6-6 1-5 BYE BYE 4-3 5-3 BYE BYE 10-4 7-6 BYE BYE 8-1 5-1 BYE 9-7 10-6 7-4 BYE BYE 8-3 1-3 BYE BYE 4-5 3-6 BYE BYE 2-2 3-2 BYE BYE 2-6 5-5 BYE BYE 10-2 9-3 BYE BYE 6-4 1-7 8-7 BYE 4-1 3-1 BYE 7-7 2-7 5-4 BYE BYE 10-3 9-2 BYE BYE 6-5 1-6 BYE BYE 4-2 1-2 BYE BYE 4-6 3-5 BYE BYE 2-3 7-3 BYE BYE 8-4 9-6 10-7 BYE 6-1 7-1 BYE BYE 8-6 9-4 BYE BYE 6-3 3-3 BYE BYE 2-5 5-6 BYE BYE 10-1 5-2 BYE BYE 10-5 7-5 BYE BYE 8-2 1-4 BYE BYE 4-4 3-7 6-7 BYE 2-1",
  8: "1-1 BYE 5-7 4-7 3-4 BYE BYE 2-4 7-2 BYE BYE 8-5 9-5 10-8 BYE 6-2 9-1 BYE 3-8 6-6 1-5 BYE BYE 4-3 5-3 BYE BYE 10-4 7-6 2-8 BYE 8-1 5-1 BYE 9-7 10-6 7-4 BYE BYE 8-3 1-3 BYE BYE 4-5 3-6 6-8 BYE 2-2 3-2 BYE 7-8 2-6 5-5 BYE BYE 10-2 9-3 BYE BYE 6-4 1-7 8-7 BYE 4-1 3-1 BYE 7-7 2-7 5-4 BYE BYE 10-3 9-2 BYE BYE 6-5 1-6 8-8 BYE 4-2 1-2 BYE 5-8 4-6 3-5 BYE BYE 2-3 7-3 BYE BYE 8-4 9-6 10-7 BYE 6-1 7-1 BYE 1-8 8-6 9-4 BYE BYE 6-3 3-3 BYE BYE 2-5 5-6 4-8 BYE 10-1 5-2 BYE 9-8 10-5 7-5 BYE BYE 8-2 1-4 BYE BYE 4-4 3-7 6-7 BYE 2-1",
  9: "1-1 BYE 5-7 4-7 3-4 BYE BYE 2-4 7-2 BYE 1-9 8-5 9-5 10-8 BYE 6-2 9-1 BYE 3-8 6-6 1-5 8-9 BYE 4-3 5-3 BYE 9-9 10-4 7-6 2-8 BYE 8-1 5-1 BYE 9-7 10-6 7-4 BYE BYE 8-3 1-3 BYE 5-9 4-5 3-6 6-8 BYE 2-2 3-2 BYE 7-8 2-6 5-5 4-9 BYE 10-2 9-3 BYE BYE 6-4 1-7 8-7 BYE 4-1 3-1 BYE 7-7 2-7 5-4 BYE BYE 10-3 9-2 BYE 3-9 6-5 1-6 8-8 BYE 4-2 1-2 BYE 5-8 4-6 3-5 6-9 BYE 2-3 7-3 BYE BYE 8-4 9-6 10-7 BYE 6-1 7-1 BYE 1-8 8-6 9-4 10-9 BYE 6-3 3-3 BYE 7-9 2-5 5-6 4-8 BYE 10-1 5-2 BYE 9-8 10-5 7-5 2-9 BYE 8-2 1-4 BYE BYE 4-4 3-7 6-7 BYE 2-1",
  10: "1-1 BYE 5-7 4-7 3-4 6-10 7-10 2-4 7-2 BYE 1-9 8-5 9-5 10-8 BYE 6-2 9-1 BYE 3-8 6-6 1-5 8-9 BYE 4-3 5-3 BYE 9-9 10-4 7-6 2-8 BYE 8-1 5-1 BYE 9-7 10-6 7-4 2-10 BYE 8-3 1-3 BYE 5-9 4-5 3-6 6-8 BYE 2-2 3-2 BYE 7-8 2-6 5-5 4-9 BYE 10-2 9-3 10-10 3-10 6-4 1-7 8-7 BYE 4-1 3-1 BYE 7-7 2-7 5-4 4-10 9-10 10-3 9-2 BYE 3-9 6-5 1-6 8-8 BYE 4-2 1-2 BYE 5-8 4-6 3-5 6-9 BYE 2-3 7-3 BYE 1-10 8-4 9-6 10-7 BYE 6-1 7-1 BYE 1-8 8-6 9-4 10-9 BYE 6-3 3-3 BYE 7-9 2-5 5-6 4-8 BYE 10-1 5-2 BYE 9-8 10-5 7-5 2-9 BYE 8-2 1-4 8-10 5-10 4-4 3-7 6-7 BYE 2-1",
  1: "1-1 BYE 8-1 BYE 3-1 BYE 6-1 10-1 2-1 BYE 7-1 BYE 4-1 BYE 5-1 9-1",
  2: "1-1 BYE 2-2 10-2 9-1 BYE BYE 8-1 5-1 BYE BYE 7-2 6-2 3-2 BYE 4-1 3-1 BYE 4-2 5-2 8-2 BYE BYE 6-1 7-1 BYE BYE 10-1 9-2 1-2 BYE 2-1",
  3: "1-1 BYE 7-2 6-2 9-1 4-3 5-3 8-1 5-1 8-3 1-3 2-2 3-2 10-2 9-3 4-1 3-1 10-3 9-2 4-2 1-2 2-3 7-3 6-1 7-1 6-3 3-3 10-1 5-2 8-2 BYE 2-1",
  4: "1-1 BYE 3-4 2-4 7-2 BYE BYE 6-2 9-1 BYE BYE 4-3 5-3 10-4 BYE 8-1 5-1 BYE 7-4 8-3 1-3 BYE BYE 2-2 3-2 BYE BYE 10-2 9-3 6-4 BYE 4-1 3-1 BYE 5-4 10-3 9-2 BYE BYE 4-2 1-2 BYE BYE 2-3 7-3 8-4 BYE 6-1 7-1 BYE 9-4 6-3 3-3 BYE BYE 10-1 5-2 BYE BYE 8-2 1-4 4-4 BYE 2-1",
  5: "1-1 BYE 3-4 2-4 7-2 8-5 9-5 6-2 9-1 BYE 1-5 4-3 5-3 10-4 BYE 8-1 5-1 BYE 7-4 8-3 1-3 4-5 BYE 2-2 3-2 BYE 5-5 10-2 9-3 6-4 BYE 4-1 3-1 BYE 5-4 10-3 9-2 6-5 BYE 4-2 1-2 BYE 3-5 2-3 7-3 8-4 BYE 6-1 7-1 BYE 9-4 6-3 3-3 2-5 BYE 10-1 5-2 10-5 7-5 8-2 1-4 4-4 BYE 2-1",
  6: "1-1 BYE 3-4 2-4 7-2 8-5 9-5 6-2 9-1 6-6 1-5 4-3 5-3 10-4 7-6 8-1 5-1 10-6 7-4 8-3 1-3 4-5 3-6 2-2 3-2 2-6 5-5 10-2 9-3 6-4 BYE 4-1 3-1 BYE 5-4 10-3 9-2 6-5 1-6 4-2 1-2 4-6 3-5 2-3 7-3 8-4 9-6 6-1 7-1 8-6 9-4 6-3 3-3 2-5 5-6 10-1 5-2 10-5 7-5 8-2 1-4 4-4 BYE 2-1"
};
function lineSeeds(size) {
  if (size === 2) return [1, 2];
  return lineSeeds(size / 2).flatMap((seed, index) => index % 2 === 0 ? [seed, size + 1 - seed] : [size + 1 - seed, seed]);
}
function singleRankLines(size) {
  const reverseBits = (count) => {
    if (count === 1) return [0];
    const previous = reverseBits(count / 2);
    return [...previous.map((value) => value * 2), ...previous.map((value) => value * 2 + 1)];
  };
  return reverseBits(size / 2).flatMap((value) => [value + 1, size - value]);
}
function buildIpingSlotLabels(groupCount, qualifiersPerGroup) {
  if (!Number.isInteger(groupCount) || !Number.isInteger(qualifiersPerGroup) || groupCount < 1 || groupCount > 10 || qualifiersPerGroup < 1 || qualifiersPerGroup > 12) {
    return null;
  }
  if (groupCount === 9) return nineGroupSlots[qualifiersPerGroup]?.split(" ") ?? null;
  if (groupCount === 10) return tenGroupSlots[qualifiersPerGroup]?.split(" ") ?? null;
  if (groupCount === 1 && qualifiersPerGroup === 1) return [];
  if (groupCount === 2 && qualifiersPerGroup === 1) return ["1-1", "2-2", "2-1", "1-2"];
  if (groupCount === 4 && qualifiersPerGroup === 1) return ["1-1", "3-1", "2-1", "4-1"];
  const total = groupCount * qualifiersPerGroup;
  const bracketSize = groupCount === 1 && qualifiersPerGroup === 2 ? 4 : 2 ** Math.ceil(Math.log2(Math.max(2, total)));
  if (qualifiersPerGroup === 1) {
    return singleRankLines(bracketSize).map((seed) => seed <= groupCount ? `${seed}-1` : "BYE");
  }
  const stride = (groupCount + 2) % 4;
  const seeds = Array.from({ length: qualifiersPerGroup }, (_, rankIndex) => Array.from({ length: groupCount }, (_2, groupOffset) => `${(groupOffset + rankIndex * stride) % groupCount + 1}-${rankIndex + 1}`)).flat();
  while (seeds.length < bracketSize) seeds.push("BYE");
  for (const [left, right] of compatibilitySwaps[`${groupCount}:${qualifiersPerGroup}`] ?? []) {
    [seeds[left], seeds[right]] = [seeds[right], seeds[left]];
  }
  return lineSeeds(bracketSize).map((seed) => seeds[seed - 1]);
}

// 3ch-web/src/utils/tournamentEntrants.ts
var TOURNAMENT_START_SIZES = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024];
function tournamentCutoff(players, size) {
  const level = (player) => player.level && player.level > 0 ? player.level : Number.MAX_SAFE_INTEGER;
  const ordered = [...players].sort((a, b) => level(a) - level(b));
  const tied = players.length > size && level(ordered[size - 1]) === level(ordered[size]);
  const boundary = ordered[Math.min(size, players.length) - 1];
  const mandatory = tied ? ordered.filter((player) => level(player) < level(boundary)) : ordered.slice(0, size);
  const candidates = tied ? ordered.filter((player) => level(player) === level(boundary)) : [];
  return { ordered, mandatory, candidates, remaining: Math.min(size, players.length) - mandatory.length, tied };
}
function resolveTournamentEntrants(players, size, mode, selectedIds, shuffle) {
  if (!TOURNAMENT_START_SIZES.includes(size)) return null;
  if (mode === "manual") return [];
  if (mode === "random") return shuffle(players).slice(0, size);
  const cutoff = tournamentCutoff(players, size);
  let selected = cutoff.mandatory;
  if (cutoff.tied) {
    if (!selectedIds || new Set(selectedIds).size !== size || selectedIds.length !== size) return null;
    const allowed = new Set([...cutoff.mandatory, ...cutoff.candidates].map((player) => player.id));
    if (selectedIds.some((id) => !allowed.has(id)) || cutoff.mandatory.some((player) => !selectedIds.includes(player.id))) return null;
    selected = cutoff.ordered.filter((player) => selectedIds.includes(player.id));
  }
  const randomized = shuffle(selected);
  return randomized.sort((a, b) => (a.level || Number.MAX_SAFE_INTEGER) - (b.level || Number.MAX_SAFE_INTEGER));
}

// 3ch-web/src/utils/programMatchGenerator.ts
function resolveProgramBlueWhiteTeams(option, block) {
  if (option?.blueWhiteTeams?.blueParticipantIds?.length && option.blueWhiteTeams.whiteParticipantIds?.length) {
    return option.blueWhiteTeams;
  }
  const sourceBlock = block ?? option?.blocks?.find(
    (candidate) => candidate.competitionMode === "blue-white" && (candidate.halfSplitMatchOrder?.length || candidate.participantOrder?.length)
  );
  const storedOrder = sourceBlock?.halfSplitMatchOrder?.length ? sourceBlock.halfSplitMatchOrder : sourceBlock?.participantOrder;
  if (!storedOrder || storedOrder.length < 2) return void 0;
  const split = Math.ceil(storedOrder.length / 2);
  const blueParticipantIds = storedOrder.slice(0, split);
  const whiteParticipantIds = storedOrder.slice(split);
  return blueParticipantIds.length > 0 && whiteParticipantIds.length > 0 ? { blueParticipantIds, whiteParticipantIds } : void 0;
}
function toProgramPlayers(participants) {
  return [...participants].map((participant) => {
    const level = Number.parseInt(participant.division ?? "", 10);
    return {
      id: participant.id,
      name: participant.name,
      division: participant.division ?? null,
      level: Number.isNaN(level) ? 0 : level,
      sourceGroupId: participant.source_group_id ?? null,
      isBot: participant.is_bot === true || /^(?:BOT|BYE)\s+\d+$/i.test(participant.name)
    };
  }).sort((a, b) => (a.level || Number.MAX_SAFE_INTEGER) - (b.level || Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name));
}
function seededBracket(n) {
  function buildPrimary(size) {
    if (size === 2) return [1];
    const prev = buildPrimary(size / 2);
    const half = size / 2;
    const result2 = [];
    for (let i = 0; i < prev.length; i += 1) {
      const seed = prev[i];
      const complement = half + 1 - seed;
      if (i % 2 === 0) result2.push(seed, complement);
      else result2.push(complement, seed);
    }
    return result2;
  }
  const primary = buildPrimary(n);
  const result = [];
  for (const seed of primary) result.push(seed, n + 1 - seed);
  return result;
}
function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function seededRandom(seed) {
  let state = hashString(seed) || 1;
  return () => {
    state = Math.imul(1664525, state) + 1013904223;
    return (state >>> 0) / 4294967296;
  };
}
function shuffleStable(items, seed) {
  const random = seededRandom(seed);
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}
function rotateBySeed(items, seed) {
  if (items.length < 2) return items;
  const offset = seed % items.length || 1;
  const rotated = [...items.slice(offset), ...items.slice(0, offset)];
  return Math.floor(seed / items.length) % 2 === 1 ? rotated.reverse() : rotated;
}
function shuffleWithinLevel(items, seed) {
  if (seed == null) return items;
  const buckets = /* @__PURE__ */ new Map();
  items.forEach((item) => {
    const level = item.level ?? 0;
    buckets.set(level, [...buckets.get(level) ?? [], item]);
  });
  return [...buckets.keys()].sort((a, b) => (a || Number.MAX_SAFE_INTEGER) - (b || Number.MAX_SAFE_INTEGER)).flatMap((level) => rotateBySeed(buckets.get(level) ?? [], seed + level * 997));
}
function sourceGroupsOf(unit) {
  if (unit.sourceGroupIds?.length) return unit.sourceGroupIds;
  if (unit.sourceGroupId) return [unit.sourceGroupId];
  return [];
}
function sameClubMatch(left, right) {
  const rightGroups = new Set(sourceGroupsOf(right));
  const leftGroups = sourceGroupsOf(left);
  return leftGroups.length > 0 && leftGroups.some((groupId) => rightGroups.has(groupId));
}
function distributeClubAware(items, sizes) {
  const groups = sizes.map(() => []);
  const sums = sizes.map(() => 0);
  [...items].sort((a, b) => ((a.level ?? 0) || Number.MAX_SAFE_INTEGER) - ((b.level ?? 0) || Number.MAX_SAFE_INTEGER)).forEach((item) => {
    const itemGroups = sourceGroupsOf(item);
    const target = groups.map((group, index) => ({
      index,
      full: group.length >= sizes[index],
      overlap: group.reduce((count, member) => count + (sourceGroupsOf(member).some((id) => itemGroups.includes(id)) ? 1 : 0), 0),
      size: group.length,
      sum: sums[index]
    })).filter((candidate) => !candidate.full).sort((a, b) => a.overlap - b.overlap || a.size - b.size || a.sum - b.sum)[0]?.index;
    if (target == null) return;
    groups[target].push(item);
    sums[target] += item.level ?? 0;
  });
  return groups;
}
function unitRosters(players, size, mode) {
  if (mode === "same") {
    const byClub = /* @__PURE__ */ new Map();
    players.forEach((player) => {
      const key = player.sourceGroupId ?? `unknown-${player.id}`;
      byClub.set(key, [...byClub.get(key) ?? [], player]);
    });
    return [...byClub.values()].flatMap((clubPlayers) => {
      const count2 = Math.max(1, Math.floor(clubPlayers.length / size));
      const sizes2 = Array.from({ length: count2 }, (_, index) => Math.floor(clubPlayers.length / count2) + (index < clubPlayers.length % count2 ? 1 : 0));
      return distributeSnake(clubPlayers, sizes2).map((group) => group.players);
    });
  }
  const count = Math.max(1, Math.floor(players.length / size));
  const sizes = Array.from({ length: count }, (_, index) => Math.floor(players.length / count) + (index < players.length % count ? 1 : 0));
  return distributeClubAware(players, sizes);
}
function makeMatch(id, order, a, b, roundNumber, bracket, label) {
  const match = {
    id,
    match_order: order,
    participant_a_id: a.id,
    participant_b_id: b.id,
    participant_a_name: a.name,
    participant_a_division: a.division ?? null,
    participant_b_name: b.name,
    participant_b_division: b.division ?? null,
    score_a: null,
    score_b: null,
    court: null,
    status: "pending",
    bracket,
    round_number: roundNumber,
    match_label: label ?? null,
    next_match_id: null,
    next_slot: null,
    loser_next_match_id: null,
    loser_next_slot: null,
    participant_a_seed_label: a.seedLabel ?? null,
    participant_b_seed_label: b.seedLabel ?? null
  };
  const unitA = a;
  const unitB = b;
  return {
    ...match,
    ...unitA.roster ? { participant_a_roster: unitA.roster } : {},
    ...unitB.roster ? { participant_b_roster: unitB.roster } : {},
    ...unitA.rosterDetails ? { participant_a_roster_details: unitA.rosterDetails } : {},
    ...unitB.rosterDetails ? { participant_b_roster_details: unitB.rosterDetails } : {}
  };
}
function pairLabel(players) {
  return players.map((player) => player.name).join(" \xB7 ");
}
function toDoublesUnits(players, assignments, clubMode = "mixed") {
  const units = assignments?.length ? assignedPlayers(assignments, players).filter((unit) => unit.length === 2) : unitRosters(players, 2, clubMode).filter((unit) => unit.length === 2);
  return units.map((unit, index) => ({
    id: unit.map((player) => player.id).join("+"),
    name: pairLabel(unit),
    division: String(unit.reduce((sum, player) => sum + (player.level ?? 0), 0)),
    level: index + 1,
    roster: unit.map((player) => player.name),
    rosterDetails: unit.map((player) => ({
      name: player.name,
      division: player.division
    })),
    sourceGroupIds: [...new Set(unit.flatMap((player) => player.sourceGroupId ? [player.sourceGroupId] : []))]
  }));
}
function toTeamUnitsFromGroupSizes(players, groupSizes, clubMode = "mixed") {
  const targetSize = Math.max(1, Math.round(players.length / Math.max(1, groupSizes.length)));
  return unitRosters(players, targetSize, clubMode).filter((roster) => roster.length > 0).map((roster, index) => {
    const leader = roster[0];
    return {
      id: roster.map((player) => player.id).join("+"),
      name: `\uD300 ${leader.name}`,
      division: String(roster.reduce((sum, player) => sum + (player.level ?? 0), 0)),
      level: index + 1,
      roster: roster.map((player) => player.name),
      rosterDetails: roster.map((player) => ({
        name: player.name,
        division: player.division
      })),
      sourceGroupIds: [...new Set(roster.flatMap((player) => player.sourceGroupId ? [player.sourceGroupId] : []))]
    };
  });
}
function assignedPlayers(assignments, players) {
  return assignments.map((group) => group.flatMap((assigned) => {
    const player = players.find((candidate) => candidate.name === assigned.name && candidate.level === assigned.level) ?? players.find((candidate) => candidate.name === assigned.name);
    return player ? [player] : [];
  }));
}
function teamUnitsFromAssignments(assignments, players) {
  return assignedPlayers(assignments, players).filter((roster) => roster.length > 0).map((roster, index) => ({
    id: roster.map((player) => player.id).join("+"),
    name: `\uD300 ${roster[0].name}`,
    division: String(roster.reduce((sum, player) => sum + (player.level ?? 0), 0)),
    level: index + 1,
    roster: roster.map((player) => player.name),
    rosterDetails: roster.map((player) => ({ name: player.name, division: player.division })),
    sourceGroupIds: [...new Set(roster.flatMap((player) => player.sourceGroupId ? [player.sourceGroupId] : []))]
  }));
}
function assignedTeamGroups(assignments, units) {
  return assignments.map((group) => group.flatMap((assigned) => {
    const rosterNames = assigned.roster?.map((member) => member.name) ?? [];
    const unit = units.find(
      (candidate) => rosterNames.length > 0 ? rosterNames.every((name) => candidate.roster?.includes(name)) : candidate.name?.includes(assigned.name)
    );
    return unit ? [unit] : [];
  }));
}
function buildUnitRoundRobinMatches(leagueId, roundIndex, block, units, groupName) {
  const orderedUnits = units.map((unit, index) => ({
    ...unit,
    seedLabel: String(index + 1)
  }));
  const upperHalfSize = Math.ceil(orderedUnits.length / 2);
  const isSameHalf = (leftIndex, rightIndex) => leftIndex < upperHalfSize === rightIndex < upperHalfSize;
  return generateRoundRobin(orderedUnits.length).map(([leftIndex, rightIndex], index) => {
    const match = makeMatch(
      `program-${leagueId}-r${roundIndex + 1}-${groupName ?? "units"}-${index + 1}`,
      index + 1,
      orderedUnits[leftIndex],
      orderedUnits[rightIndex],
      roundIndex + 1,
      null,
      block.format === "GROUP" && groupName ? groupName : void 0
    );
    return {
      ...match,
      is_no_game: Boolean(
        block.crossClubOnlyMatches && sameClubMatch(orderedUnits[leftIndex], orderedUnits[rightIndex]) || block.halfSplitOnlyMatches && isSameHalf(leftIndex, rightIndex)
      )
    };
  });
}
function buildTournamentSlots(leagueId, roundIndex, block, players, forcedSeeding, bracketIndex = 1) {
  const configuredSize = block.roundOption !== "FINAL" ? block.tournamentStartSize : void 0;
  const seeding = forcedSeeding ?? block.tournamentSeeding ?? "seed";
  if (configuredSize) {
    const selected = resolveTournamentEntrants(
      players,
      configuredSize,
      seeding,
      block.tournamentSelectedIds?.[String(bracketIndex)],
      (values) => shuffleStable(values, `${leagueId}-r${roundIndex + 1}-b${bracketIndex}-entrants-${players.map((player) => player.id).sort().join("|")}`)
    );
    if (!selected) return [];
    if (seeding !== "manual") players = selected;
  }
  const bracketSize = configuredSize ?? 2 ** Math.ceil(Math.log2(Math.max(2, players.length)));
  const emptySlots = Array.from({ length: bracketSize }).fill(null);
  if (seeding === "manual") {
    return emptySlots;
  }
  const orderedPlayers = seeding === "random" ? shuffleStable(players, `${leagueId}-r${roundIndex + 1}-${players.map((player) => player.id).join("|")}`) : players;
  const seedPositions = seededBracket(bracketSize);
  const slots = [...emptySlots];
  orderedPlayers.forEach((player, index) => {
    const seedNumber = index + 1;
    const slotIndex = seedPositions.indexOf(seedNumber);
    if (slotIndex >= 0) slots[slotIndex] = player;
  });
  if (block.crossClubGrouping) {
    for (let index = 0; index < slots.length; index += 2) {
      const left = slots[index];
      const right = slots[index + 1];
      if (!left || !right || !sameClubMatch(left, right)) continue;
      const swapIndex = slots.findIndex((candidate, candidateIndex) => candidateIndex > index + 1 && candidate && !sameClubMatch(left, candidate));
      if (swapIndex >= 0) [slots[index + 1], slots[swapIndex]] = [slots[swapIndex], slots[index + 1]];
    }
  }
  return slots;
}
function getTournamentRoundLabel(bracketSize, bracketRound) {
  const roundSize = bracketSize / 2 ** (bracketRound - 1);
  return roundSize <= 2 ? "\uACB0\uC2B9" : `${roundSize}\uAC15`;
}
function assignedMatchUnits(assignments, units) {
  const remaining = [...units];
  return assignments.map((group) => group.flatMap((assigned) => {
    let unitIndex = remaining.findIndex(
      (candidate) => candidate.name === assigned.name && (candidate.level ?? 0) === assigned.level
    );
    if (unitIndex < 0) {
      unitIndex = remaining.findIndex((candidate) => candidate.name === assigned.name);
    }
    if (unitIndex < 0) return [];
    const [unit] = remaining.splice(unitIndex, 1);
    return [unit];
  }));
}
function resolveTournamentMatchRule(baseRule, lateRule, switchSize, stageSize) {
  const shouldSwitch = switchSize === 0 || switchSize != null && stageSize <= switchSize;
  return lateRule && shouldSwitch ? lateRule : baseRule;
}
function completeAutomaticOpeningWalkover(match, seeding) {
  const hasExactlyOneParticipant = Boolean(match.participant_a_id) !== Boolean(match.participant_b_id);
  if (seeding === "manual" || match.bracket !== "upper" || match.round_number !== 1 || !hasExactlyOneParticipant) {
    return match;
  }
  return { ...match, status: "done", score_a: 0, score_b: 0 };
}
function buildTournamentMatches(leagueId, roundIndex, block, players, forcedSeeding, bracketIndex = 1) {
  const matches = [];
  const slots = buildTournamentSlots(leagueId, roundIndex, block, players, forcedSeeding, bracketIndex);
  const bracketSize = slots.length;
  let previousRoundIds = [];
  for (let bracketRound = 1, matchCount = bracketSize / 2; matchCount >= 1; bracketRound += 1, matchCount /= 2) {
    const currentRoundIds = [];
    for (let matchIndex = 0; matchIndex < matchCount; matchIndex += 1) {
      const matchId = `program-${leagueId}-r${roundIndex + 1}-t${bracketIndex}-r${bracketRound}-m${matchIndex + 1}`;
      currentRoundIds.push(matchId);
      const isFirstRound = bracketRound === 1;
      const a = isFirstRound ? slots[matchIndex * 2] ?? { id: null, name: null, division: null } : { id: null, name: null, division: null };
      const b = isFirstRound ? slots[matchIndex * 2 + 1] ?? { id: null, name: null, division: null } : { id: null, name: null, division: null };
      const match = makeMatch(
        matchId,
        matches.length + 1,
        a,
        b,
        bracketRound,
        "upper",
        getTournamentRoundLabel(bracketSize, bracketRound)
      );
      matches.push({ ...match, tournament_bracket_index: bracketIndex });
    }
    previousRoundIds.forEach((previousId, previousIndex) => {
      const parentId = currentRoundIds[Math.floor(previousIndex / 2)];
      const previousMatch = matches.find((match) => match.id === previousId);
      if (previousMatch) {
        previousMatch.next_match_id = parentId;
        previousMatch.next_slot = previousIndex % 2 === 0 ? "a" : "b";
      }
    });
    previousRoundIds = currentRoundIds;
  }
  const shouldCreateThirdPlaceMatch = block.thirdPlaceMatch ?? (block.tournamentBracketCount ?? 1) === 1;
  if (bracketSize >= 4 && shouldCreateThirdPlaceMatch) {
    const finalMatch = matches[matches.length - 1];
    const finalRound = finalMatch.round_number ?? Math.log2(bracketSize);
    const semifinalMatches = matches.filter(
      (match) => match.bracket === "upper" && match.round_number === finalRound - 1
    );
    if (semifinalMatches.length === 2) {
      const thirdPlaceId = `program-${leagueId}-r${roundIndex + 1}-t${bracketIndex}-r${finalRound}-m0`;
      const thirdPlaceMatch = makeMatch(
        thirdPlaceId,
        finalMatch.match_order,
        { id: null, name: null, division: null },
        { id: null, name: null, division: null },
        finalRound,
        "upper",
        "3\xB74\uC704\uC804"
      );
      semifinalMatches.forEach((semifinal, index) => {
        semifinal.loser_next_match_id = thirdPlaceId;
        semifinal.loser_next_slot = index === 0 ? "a" : "b";
      });
      finalMatch.match_order += 1;
      finalMatch.match_label = "\uACB0\uC2B9";
      matches.splice(matches.length - 1, 0, {
        ...thirdPlaceMatch,
        tournament_bracket_index: bracketIndex
      });
    }
  }
  const seeding = forcedSeeding ?? block.tournamentSeeding;
  return matches.map((sourceMatch) => {
    const match = completeAutomaticOpeningWalkover(sourceMatch, seeding);
    const stageSize = bracketSize / 2 ** ((match.round_number ?? 1) - 1);
    return {
      ...match,
      match_rule: block.nextMatchRule ?? resolveTournamentMatchRule(
        block.matchRule,
        block.lateMatchRule,
        block.ruleSwitchSize,
        stageSize
      )
    };
  });
}
function buildUpperLowerTournamentMatches(leagueId, roundIndex, block, players, forcedSeeding, bracketIndex = 1) {
  const slots = buildTournamentSlots(leagueId, roundIndex, block, players, forcedSeeding, bracketIndex);
  const bracketSize = slots.length;
  if (bracketSize < 4) {
    return buildTournamentMatches(leagueId, roundIndex, block, players, forcedSeeding, bracketIndex);
  }
  const openingCount = bracketSize / 2;
  const innerRounds = Math.log2(openingCount);
  const openingIds = Array.from(
    { length: openingCount },
    (_, index) => `program-${leagueId}-r${roundIndex + 1}-t${bracketIndex}-open-m${index + 1}`
  );
  const upperRoundIds = Array.from(
    { length: innerRounds },
    (_, roundOffset) => Array.from(
      { length: openingCount / 2 ** (roundOffset + 1) },
      (_2, index) => `program-${leagueId}-r${roundIndex + 1}-t${bracketIndex}-upper-r${roundOffset + 2}-m${index + 1}`
    )
  );
  const lowerRoundIds = Array.from(
    { length: innerRounds },
    (_, roundOffset) => Array.from(
      { length: openingCount / 2 ** (roundOffset + 1) },
      (_2, index) => `program-${leagueId}-r${roundIndex + 1}-t${bracketIndex}-lower-r${roundOffset + 1}-m${index + 1}`
    )
  );
  const matches = [];
  openingIds.forEach((matchId, matchIndex) => {
    const match = makeMatch(
      matchId,
      matches.length + 1,
      slots[matchIndex * 2] ?? { id: null, name: null },
      slots[matchIndex * 2 + 1] ?? { id: null, name: null },
      1,
      "upper",
      getTournamentRoundLabel(bracketSize, 1)
    );
    matches.push({
      ...match,
      next_match_id: upperRoundIds[0]?.[Math.floor(matchIndex / 2)] ?? null,
      next_slot: matchIndex % 2 === 0 ? "a" : "b",
      loser_next_match_id: lowerRoundIds[0]?.[Math.floor(matchIndex / 2)] ?? null,
      loser_next_slot: matchIndex % 2 === 0 ? "a" : "b",
      tournament_bracket_index: bracketIndex
    });
  });
  upperRoundIds.forEach((roundIds, roundOffset) => {
    roundIds.forEach((matchId, matchIndex) => {
      const isFinal = roundOffset === upperRoundIds.length - 1;
      const match = makeMatch(
        matchId,
        matches.length + 1,
        { id: null, name: null },
        { id: null, name: null },
        roundOffset + 2,
        "upper",
        isFinal ? "\uC0C1\uC704 \uACB0\uC2B9" : `\uC0C1\uC704 ${getTournamentRoundLabel(openingCount, roundOffset + 1)}`
      );
      matches.push({
        ...match,
        next_match_id: isFinal ? null : upperRoundIds[roundOffset + 1]?.[Math.floor(matchIndex / 2)] ?? null,
        next_slot: isFinal ? null : matchIndex % 2 === 0 ? "a" : "b",
        tournament_bracket_index: bracketIndex
      });
    });
  });
  lowerRoundIds.forEach((roundIds, roundOffset) => {
    roundIds.forEach((matchId, matchIndex) => {
      const isFinal = roundOffset === lowerRoundIds.length - 1;
      const match = makeMatch(
        matchId,
        matches.length + 1,
        { id: null, name: null },
        { id: null, name: null },
        roundOffset + 1,
        "lower",
        isFinal ? "\uD558\uC704 \uACB0\uC2B9" : `\uD558\uC704 ${getTournamentRoundLabel(openingCount, roundOffset + 1)}`
      );
      matches.push({
        ...match,
        next_match_id: isFinal ? null : lowerRoundIds[roundOffset + 1]?.[Math.floor(matchIndex / 2)] ?? null,
        next_slot: isFinal ? null : matchIndex % 2 === 0 ? "a" : "b",
        tournament_bracket_index: bracketIndex
      });
    });
  });
  if (block.thirdPlaceMatch && innerRounds >= 2) {
    const addThirdPlaceMatch = (bracket, semifinalRound, finalRound) => {
      const semifinals = matches.filter((match) => match.bracket === bracket && match.round_number === semifinalRound);
      const final = matches.find((match) => match.bracket === bracket && match.round_number === finalRound);
      if (semifinals.length !== 2 || !final) return;
      const thirdPlaceId = `program-${leagueId}-r${roundIndex + 1}-t${bracketIndex}-${bracket}-third-m0`;
      semifinals.forEach((semifinal, index) => {
        semifinal.loser_next_match_id = thirdPlaceId;
        semifinal.loser_next_slot = index === 0 ? "a" : "b";
      });
      matches.push({
        ...makeMatch(thirdPlaceId, final.match_order, { id: null, name: null }, { id: null, name: null }, finalRound, bracket, `${bracket === "upper" ? "\uC0C1\uC704" : "\uD558\uC704"} 3\xB74\uC704\uC804`),
        tournament_bracket_index: bracketIndex
      });
    };
    addThirdPlaceMatch("upper", innerRounds, innerRounds + 1);
    addThirdPlaceMatch("lower", innerRounds - 1, innerRounds);
  }
  const seeding = forcedSeeding ?? block.tournamentSeeding;
  return matches.map((sourceMatch) => {
    const match = completeAutomaticOpeningWalkover(sourceMatch, seeding);
    const stageSize = match.bracket === "lower" ? bracketSize / 2 ** (match.round_number ?? 1) : bracketSize / 2 ** ((match.round_number ?? 1) - 1);
    const isLower = match.bracket === "lower";
    return {
      ...match,
      match_rule: block.nextMatchRule ?? resolveTournamentMatchRule(
        isLower ? block.lowerMatchRule ?? block.matchRule : block.matchRule,
        isLower ? block.lowerLateMatchRule : block.lateMatchRule,
        isLower ? block.lowerRuleSwitchSize : block.ruleSwitchSize,
        stageSize
      )
    };
  });
}
function splitTournamentUnits(units, bracketCount) {
  const count = Math.min(Math.max(1, bracketCount), Math.max(1, units.length));
  const brackets = Array.from({ length: count }, () => []);
  units.forEach((unit, index) => brackets[index % count].push(unit));
  return brackets.filter((bracket) => bracket.length > 0);
}
function hasCompletedResult(match) {
  if (match.status === "done") return true;
  return match.score_a != null && match.score_b != null && Number(match.score_a) !== Number(match.score_b);
}
function getRankedPlayersFromPreviousRound(players, sourceMatches, previousRound, matchRule, manualParticipantOrder) {
  const previousMatches = sourceMatches.filter(
    (match) => (match.program_round ?? match.round_number) === previousRound && !match.bracket && !match.is_no_game && match.participant_a_id && match.participant_b_id
  );
  if (previousMatches.length === 0 || previousMatches.some((match) => !hasCompletedResult(match))) {
    return null;
  }
  const playerById = new Map(players.map((player) => [player.id, player]));
  const playerIndex = new Map(players.map((player, index) => [player.id, index]));
  const manualIndex = new Map((manualParticipantOrder ?? []).map((id, index) => [id, index]));
  const compareFinalTieBreak = (left, right) => {
    const manualDiff = (manualIndex.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (manualIndex.get(right.id) ?? Number.MAX_SAFE_INTEGER);
    if (manualDiff !== 0) return manualDiff;
    return (playerIndex.get(left.id) ?? 0) - (playerIndex.get(right.id) ?? 0);
  };
  const stats = /* @__PURE__ */ new Map();
  players.forEach((player) => stats.set(player.id, { wins: 0, losses: 0, setTotal: 0, played: 0 }));
  previousMatches.forEach((match) => {
    const aId = match.participant_a_id;
    const bId = match.participant_b_id;
    if (!aId || !bId || !playerById.has(aId) || !playerById.has(bId)) return;
    const scoreA = match.score_a ?? 0;
    const scoreB = match.score_b ?? 0;
    const aStats = stats.get(aId);
    const bStats = stats.get(bId);
    aStats.played += 1;
    bStats.played += 1;
    aStats.setTotal += scoreA;
    bStats.setTotal += scoreB;
    const winScore = getRoundRobinWinScore(match.match_rule ?? matchRule);
    if (winScore !== null) {
      if (scoreA >= winScore) aStats.wins += 1;
      else aStats.losses += 1;
      if (scoreB >= winScore) bStats.wins += 1;
      else bStats.losses += 1;
    } else if (scoreA > scoreB) {
      aStats.wins += 1;
      bStats.losses += 1;
    } else if (scoreB > scoreA) {
      bStats.wins += 1;
      aStats.losses += 1;
    }
  });
  const byWins = /* @__PURE__ */ new Map();
  players.forEach((player) => {
    const wins = stats.get(player.id)?.wins ?? 0;
    byWins.set(wins, [...byWins.get(wins) ?? [], player]);
  });
  const isThreeSetRule = matchRule === "3\uC138\uD2B8\uC81C" || matchRule === "THREE_SET";
  const tieGroups = isThreeSetRule ? players.reduce((groups, player) => {
    const setTotal = stats.get(player.id)?.setTotal ?? 0;
    groups.set(setTotal, [...groups.get(setTotal) ?? [], player]);
    return groups;
  }, /* @__PURE__ */ new Map()) : byWins;
  const tieWon = /* @__PURE__ */ new Map();
  const tieLost = /* @__PURE__ */ new Map();
  players.forEach((player) => {
    tieWon.set(player.id, 0);
    tieLost.set(player.id, 0);
  });
  for (const group of tieGroups.values()) {
    if (group.length < 2) continue;
    const groupIds = new Set(group.map((player) => player.id));
    previousMatches.forEach((match) => {
      const aId = match.participant_a_id;
      const bId = match.participant_b_id;
      if (!aId || !bId || !groupIds.has(aId) || !groupIds.has(bId)) return;
      const scoreA = match.score_a ?? 0;
      const scoreB = match.score_b ?? 0;
      tieWon.set(aId, (tieWon.get(aId) ?? 0) + scoreA);
      tieLost.set(aId, (tieLost.get(aId) ?? 0) + scoreB);
      tieWon.set(bId, (tieWon.get(bId) ?? 0) + scoreB);
      tieLost.set(bId, (tieLost.get(bId) ?? 0) + scoreA);
    });
  }
  return [...players].sort((left, right) => {
    const leftStats = stats.get(left.id);
    const rightStats = stats.get(right.id);
    const leftTieLost = tieLost.get(left.id) ?? 0;
    const rightTieLost = tieLost.get(right.id) ?? 0;
    if (isThreeSetRule) {
      if (leftStats.setTotal !== rightStats.setTotal) {
        return rightStats.setTotal - leftStats.setTotal;
      }
      const leftTieWon = tieWon.get(left.id) ?? 0;
      const rightTieWon = tieWon.get(right.id) ?? 0;
      if (leftTieWon !== rightTieWon) return rightTieWon - leftTieWon;
      if (leftTieLost !== rightTieLost) return leftTieLost - rightTieLost;
      return compareFinalTieBreak(left, right);
    }
    if (leftStats.wins !== rightStats.wins) return rightStats.wins - leftStats.wins;
    const leftRatio = leftTieLost === 0 ? Infinity : (tieWon.get(left.id) ?? 0) / leftTieLost;
    const rightRatio = rightTieLost === 0 ? Infinity : (tieWon.get(right.id) ?? 0) / rightTieLost;
    if (leftRatio !== rightRatio) return rightRatio - leftRatio;
    return compareFinalTieBreak(left, right);
  });
}
function getRankedGroupsFromPreviousRound(players, sourceMatches, previousRound, matchRule) {
  const previousMatches = sourceMatches.filter(
    (match) => (match.program_round ?? match.round_number) === previousRound && !match.bracket && !match.is_no_game && match.match_label && match.participant_a_id && match.participant_b_id
  );
  if (previousMatches.length === 0 || previousMatches.some((match) => !hasCompletedResult(match))) return null;
  const labels = [...new Set(previousMatches.map((match) => match.match_label))].sort();
  const playerById = new Map(players.map((player) => [player.id, player]));
  return labels.map((label) => {
    const labelMatches = previousMatches.filter((match) => match.match_label === label);
    const ids = new Set(labelMatches.flatMap((match) => [match.participant_a_id, match.participant_b_id]).filter(Boolean));
    const groupPlayers = [...ids].flatMap((id) => {
      const player = playerById.get(id);
      return player ? [player] : [];
    });
    return getRankedPlayersFromPreviousRound(
      groupPlayers,
      labelMatches,
      previousRound,
      matchRule
    ) ?? groupPlayers;
  }).filter((group) => group.length > 0);
}
function asRankingPlayers(units) {
  return units.flatMap(
    (unit, index) => unit.id && unit.name ? [{
      id: unit.id,
      name: unit.name,
      division: unit.division ?? null,
      level: unit.level ?? index + 1
    }] : []
  );
}
function getRankedTournamentPools(units, sourceMatches, sourceRound) {
  const unitById = new Map(units.flatMap((unit) => unit.id ? [[unit.id, unit]] : []));
  const tournamentMatches = applyProgramTournamentAdvancement(
    sourceMatches.filter(
      (match) => (match.program_round ?? match.round_number) === sourceRound && Boolean(match.bracket)
    )
  );
  if (tournamentMatches.length === 0) return null;
  const bracketIndexes = [
    ...new Set(tournamentMatches.map((match) => match.tournament_bracket_index ?? 1))
  ].sort((left, right) => left - right);
  const pools = bracketIndexes.flatMap((bracketIndex) => {
    const bracketMatches = tournamentMatches.filter(
      (match) => (match.tournament_bracket_index ?? 1) === bracketIndex
    );
    const upperMatches = bracketMatches.filter((match) => match.bracket === "upper");
    const finalRound = Math.max(...upperMatches.map((match) => match.round_number ?? 0));
    const finalRoundMatches = upperMatches.filter(
      (match) => (match.round_number ?? 0) === finalRound
    );
    const finalMatch = finalRoundMatches.find(
      (match) => /결승/.test(match.match_label ?? "") && !/3\s*[·.]?\s*4위전/.test(match.match_label ?? "")
    ) ?? finalRoundMatches.find(
      (match) => !/3\s*[·.]?\s*4위전/.test(match.match_label ?? "")
    );
    if (!finalMatch || !hasCompletedResult(finalMatch)) return [];
    const winner = getTournamentWinner(finalMatch);
    const runnerUp = getTournamentLoser(finalMatch);
    const semifinalLosers = upperMatches.filter((match) => (match.round_number ?? 0) === finalRound - 1).map(getTournamentLoser).filter(Boolean);
    const rankedUnits = [winner, runnerUp, ...semifinalLosers].flatMap((result) => {
      if (!result?.id) return [];
      return [unitById.get(result.id) ?? {
        id: result.id,
        name: result.name,
        division: result.division,
        seedLabel: result.seedLabel
      }];
    });
    return rankedUnits.length > 0 ? [rankedUnits] : [];
  });
  return pools.length === bracketIndexes.length ? pools : null;
}
function getRankedUnitPools(units, sourceMatches, sourceRound, previousBlock) {
  if (previousBlock?.format === "TOURNAMENT") {
    return getRankedTournamentPools(units, sourceMatches, sourceRound);
  }
  const rankingPlayers = asRankingPlayers(units);
  const unitById = new Map(units.flatMap((unit) => unit.id ? [[unit.id, unit]] : []));
  if (previousBlock?.format === "GROUP") {
    const rankedGroups = getRankedGroupsFromPreviousRound(
      rankingPlayers,
      sourceMatches,
      sourceRound,
      previousBlock?.matchRule
    );
    return rankedGroups?.map(
      (group) => group.flatMap((player) => {
        const unit = unitById.get(player.id);
        return unit ? [unit] : [];
      })
    ) ?? null;
  }
  const ranked = getRankedPlayersFromPreviousRound(
    rankingPlayers,
    sourceMatches,
    sourceRound,
    previousBlock?.matchRule
  );
  return ranked ? [ranked.flatMap((player) => {
    const unit = unitById.get(player.id);
    return unit ? [unit] : [];
  })] : null;
}
function getSavedRankedUnitPools(option, sourceRound, units) {
  const snapshot = option?.roundStandings?.find(
    (item) => item.round === sourceRound
  );
  if (!snapshot) return null;
  const unitById = new Map(
    units.flatMap((unit) => unit.id ? [[unit.id, unit]] : [])
  );
  const orderedSnapshotPools = [...snapshot.pools].sort((left, right) => {
    const teamOrder = (label) => label === "\uCCAD\uD300" ? 0 : label === "\uBC31\uD300" ? 1 : 2;
    const leftTeamOrder = teamOrder(left.label);
    const rightTeamOrder = teamOrder(right.label);
    if (leftTeamOrder !== rightTeamOrder) return leftTeamOrder - rightTeamOrder;
    const leftNumber = Number.parseInt(left.label, 10);
    const rightNumber = Number.parseInt(right.label, 10);
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber;
    return left.label.localeCompare(right.label, "ko", { numeric: true });
  });
  const placeholderPools = buildRankPlaceholderPools(
    orderedSnapshotPools.map((pool) => pool.participantIds.length),
    void 0,
    orderedSnapshotPools.map((pool) => pool.label)
  );
  const pools = orderedSnapshotPools.map((pool, poolIndex) => {
    if (!pool.complete) return placeholderPools[poolIndex] ?? [];
    return pool.participantIds.flatMap((id) => {
      const unit = unitById.get(id);
      return unit ? [unit] : [];
    });
  });
  return pools.length > 0 && pools.every((pool) => pool.length > 0) ? pools : null;
}
function buildProgramRoundStandingsSnapshot(option, round, sourceMatches) {
  const block = option?.blocks?.[round - 1];
  if (!block) return null;
  const roundMatches = sourceMatches.filter(
    (match) => (match.program_round ?? match.round_number) === round && !match.is_no_game
  );
  if (roundMatches.length === 0) return null;
  const resolveCustomizedParticipantId = (match, side) => {
    const storedId = side === "a" ? match.participant_a_id : match.participant_b_id;
    if (block.participantOrderCustomized !== true || !block.participantOrder?.length) return storedId;
    const seedLabel = side === "a" ? match.participant_a_seed_label : match.participant_b_seed_label;
    const seedIndex = Number(seedLabel) - 1;
    if (!Number.isInteger(seedIndex) || seedIndex < 0) return storedId;
    const groupSizes = block.groupSizes?.length ? block.groupSizes : [block.participantOrder.length];
    const groupMatched = String(match.match_label ?? "").match(/^(\d+)(?:위)?조$/);
    const groupIndex = groupMatched ? Number(groupMatched[1]) - 1 : 0;
    if (!Number.isInteger(groupIndex) || groupIndex < 0 || groupIndex >= groupSizes.length) return storedId;
    const offset = groupSizes.slice(0, groupIndex).reduce((sum, size) => sum + size, 0);
    return block.participantOrder[offset + seedIndex] ?? storedId;
  };
  const effectiveRoundMatches = roundMatches.map((match) => ({
    ...match,
    participant_a_id: resolveCustomizedParticipantId(match, "a"),
    participant_b_id: resolveCustomizedParticipantId(match, "b")
  }));
  const unitById = /* @__PURE__ */ new Map();
  effectiveRoundMatches.forEach((match) => {
    if (match.participant_a_id && !match.participant_a_id.startsWith("placeholder-")) {
      unitById.set(match.participant_a_id, {
        id: match.participant_a_id,
        name: match.participant_a_name,
        division: match.participant_a_division,
        seedLabel: match.participant_a_seed_label ?? void 0,
        isBot: /^(?:BOT|BYE)\s+\d+$/i.test(match.participant_a_name ?? "")
      });
    }
    if (match.participant_b_id && !match.participant_b_id.startsWith("placeholder-")) {
      unitById.set(match.participant_b_id, {
        id: match.participant_b_id,
        name: match.participant_b_name,
        division: match.participant_b_division,
        seedLabel: match.participant_b_seed_label ?? void 0,
        isBot: /^(?:BOT|BYE)\s+\d+$/i.test(match.participant_b_name ?? "")
      });
    }
  });
  if (block.format === "GROUP") {
    const labels = [...new Set(
      effectiveRoundMatches.map((match) => match.match_label).filter(Boolean)
    )].sort(
      (left, right) => (Number.parseInt(left, 10) || 0) - (Number.parseInt(right, 10) || 0)
    );
    if (labels.length === 0) return null;
    const rankingPlayers = asRankingPlayers([...unitById.values()]);
    const playerById = new Map(rankingPlayers.map((player) => [player.id, player]));
    const pools = labels.map((label) => {
      const labelMatches = effectiveRoundMatches.filter((match) => match.match_label === label);
      const seedByParticipantId = /* @__PURE__ */ new Map();
      labelMatches.forEach((match) => {
        const aSeed = match.participant_a_seed_label == null ? null : Number(match.participant_a_seed_label);
        const bSeed = match.participant_b_seed_label == null ? null : Number(match.participant_b_seed_label);
        if (match.participant_a_id && aSeed != null && Number.isFinite(aSeed)) {
          seedByParticipantId.set(match.participant_a_id, aSeed);
        }
        if (match.participant_b_id && bSeed != null && Number.isFinite(bSeed)) {
          seedByParticipantId.set(match.participant_b_id, bSeed);
        }
      });
      const participantIds = [...new Set(
        labelMatches.flatMap(
          (match) => [match.participant_a_id, match.participant_b_id].filter(Boolean)
        )
      )].sort(
        (left, right) => (seedByParticipantId.get(left) ?? Number.MAX_SAFE_INTEGER) - (seedByParticipantId.get(right) ?? Number.MAX_SAFE_INTEGER)
      );
      const groupPlayers = participantIds.flatMap((id) => {
        const player = playerById.get(id);
        return player ? [player] : [];
      });
      const rankedPlayers = getRankedPlayersFromPreviousRound(
        groupPlayers,
        labelMatches,
        round,
        block.matchRule,
        option.roundTieBreaks?.find(
          (tieBreak) => tieBreak.round === round && tieBreak.poolLabel === label
        )?.participantIds
      );
      return {
        label,
        complete: rankedPlayers !== null,
        participantIds: (rankedPlayers ?? groupPlayers).map((player) => player.id)
      };
    });
    return {
      round,
      complete: pools.every((pool) => pool.complete),
      pools,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  if (block.format === "LEAGUE" && block.competitionMode === "blue-white" && block.blueWhiteRankingMode === "by-team" && option?.blueWhiteTeams) {
    const rankingPlayers = asRankingPlayers([...unitById.values()]);
    const rankedAllPlayers = getRankedPlayersFromPreviousRound(
      rankingPlayers,
      effectiveRoundMatches,
      round,
      block.matchRule
    );
    const buildTeamPool = (label, participantIds) => {
      const participantIdSet = new Set(participantIds);
      const teamPlayers = (rankedAllPlayers ?? rankingPlayers).filter((player) => participantIdSet.has(player.id));
      const manualOrder = option.roundTieBreaks?.find(
        (tieBreak) => tieBreak.round === round && tieBreak.poolLabel === label
      )?.participantIds;
      const manualIndex = new Map((manualOrder ?? []).map((id, index) => [id, index]));
      const rankedPlayers = manualOrder?.length ? [...teamPlayers].sort(
        (left, right) => (manualIndex.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (manualIndex.get(right.id) ?? Number.MAX_SAFE_INTEGER)
      ) : teamPlayers;
      return {
        label,
        complete: rankedAllPlayers !== null,
        participantIds: rankedPlayers.map((player) => player.id)
      };
    };
    const pools = [
      buildTeamPool("\uCCAD\uD300", option.blueWhiteTeams.blueParticipantIds),
      buildTeamPool("\uBC31\uD300", option.blueWhiteTeams.whiteParticipantIds)
    ];
    return {
      round,
      complete: pools.every((pool) => pool.complete),
      pools,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  const rankedPools = getRankedUnitPools(
    [...unitById.values()],
    effectiveRoundMatches,
    round,
    block
  );
  if (!rankedPools) return null;
  return {
    round,
    complete: true,
    pools: rankedPools.map((pool, index) => ({
      label: `${index + 1}`,
      complete: true,
      participantIds: pool.flatMap((unit) => unit.id ? [unit.id] : [])
    })),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function distributeRankedUnitPoolsToBrackets(rankedPools, bracketCount) {
  const count = Math.min(Math.max(1, bracketCount), Math.max(1, rankedPools.flat().length));
  const brackets = Array.from(
    { length: count },
    () => []
  );
  rankedPools.forEach((pool, poolIndex) => {
    pool.forEach((unit, rankIndex) => {
      brackets[(poolIndex + rankIndex) % count].push({
        unit: {
          ...unit,
          seedLabel: `${poolIndex + 1}-${rankIndex + 1}`
        },
        poolIndex,
        rankIndex
      });
    });
  });
  return brackets.filter((bracket) => bracket.length > 0).map(
    (bracket) => bracket.sort(
      (left, right) => left.rankIndex - right.rankIndex || left.poolIndex - right.poolIndex
    ).map(({ unit }) => unit)
  );
}
function officialSeedLineOrder(size) {
  if (size === 2) return [1, 2];
  const previous = officialSeedLineOrder(size / 2);
  return previous.flatMap(
    (seed, index) => index % 2 === 0 ? [seed, size + 1 - seed] : [size + 1 - seed, seed]
  );
}
function buildTwoGroupOfficialSeedOrder(rankedPools) {
  if (rankedPools.length !== 2 || rankedPools.every((pool) => pool.length === 0)) {
    return null;
  }
  const maxRank = Math.max(...rankedPools.map((pool) => pool.length));
  const bye = () => ({ id: null, name: null, division: null });
  const seededUnits = Array.from({ length: maxRank }, (_, rankIndex) => rankIndex).flatMap((rankIndex) => rankedPools.map((pool) => pool[rankIndex] ?? bye()));
  const bracketSize = 2 ** Math.ceil(Math.log2(Math.max(2, seededUnits.length)));
  const bracketSlots = officialSeedLineOrder(bracketSize).map(
    (seed) => seededUnits[seed - 1] ?? bye()
  );
  const seedAtSlot = seededBracket(bracketSize);
  const seedOrder = Array(bracketSize);
  bracketSlots.forEach((entry, slotIndex) => {
    seedOrder[seedAtSlot[slotIndex] - 1] = entry;
  });
  return seedOrder;
}
function rotateItems(items, offset) {
  if (items.length < 2) return [...items];
  const normalized = (offset % items.length + items.length) % items.length;
  return [...items.slice(normalized), ...items.slice(0, normalized)];
}
function buildRankOrderVariants(items) {
  if (items.length < 2) return [[...items]];
  if (items.length <= 4) {
    const permutations = (remaining) => remaining.length === 0 ? [[]] : remaining.flatMap((item, index) => permutations(remaining.filter((_, otherIndex) => index !== otherIndex)).map((tail) => [item, ...tail]));
    return permutations(items);
  }
  const variants = [];
  const seen = /* @__PURE__ */ new Set();
  const bases = [[...items], [...items].reverse()];
  bases.forEach((base) => {
    for (let offset = 0; offset < base.length; offset += 1) {
      const variant = rotateItems(base, offset);
      const key = variant.map((entry) => entry.poolIndex).join("|");
      if (!seen.has(key)) {
        seen.add(key);
        variants.push(variant);
      }
    }
  });
  if (variants.length <= 24) return variants;
  const step = variants.length / 24;
  return Array.from({ length: 24 }, (_, index) => variants[Math.floor(index * step)]);
}
function tournamentMeetingRound(leftSlot, rightSlot, bracketSize) {
  const rounds = Math.log2(bracketSize);
  for (let round = 1; round <= rounds; round += 1) {
    const sectionSize = 2 ** round;
    if (Math.floor(leftSlot / sectionSize) === Math.floor(rightSlot / sectionSize)) {
      return round;
    }
  }
  return rounds;
}
function scoreCrossGroupSeedOrder(seedOrder, totalEntrants, bracketSize, maxRank, previousCount, previousScore, slotBySeed) {
  const placed = seedOrder.map((entry, index) => ({
    ...entry,
    seed: index + 1,
    slot: slotBySeed.get(index + 1) ?? index
  }));
  let score = previousScore;
  const placedByPool = /* @__PURE__ */ new Map();
  placed.forEach((entry) => {
    placedByPool.set(entry.poolIndex, [...placedByPool.get(entry.poolIndex) ?? [], entry]);
  });
  for (const poolEntries of placedByPool.values()) {
    for (const right of poolEntries.filter((entry) => entry.seed > previousCount)) {
      for (const left of poolEntries) {
        if (left.seed >= right.seed) continue;
        const meetingRound = tournamentMeetingRound(left.slot, right.slot, bracketSize);
        if (meetingRound === 1) score += 1e12;
        score += (Math.log2(bracketSize) - meetingRound + 1) * 5e3;
        if (left.rankIndex === 0 || right.rankIndex === 0) {
          score += (Math.log2(bracketSize) - meetingRound + 1) * 1e4;
        }
      }
    }
  }
  const placedBySlot = new Map(placed.map((entry) => [entry.slot, entry]));
  for (let slotIndex = 0; slotIndex < bracketSize; slotIndex += 2) {
    const left = placedBySlot.get(slotIndex);
    const right = placedBySlot.get(slotIndex + 1);
    if (!left || !right) continue;
    if (left.seed <= previousCount && right.seed <= previousCount) continue;
    if (left.rankIndex === 0 && right.rankIndex === 0) score += 5e5;
    score += Math.abs(left.rankIndex + 1 + (right.rankIndex + 1) - (maxRank + 1)) * 100;
  }
  const byeCount = bracketSize - totalEntrants;
  if (byeCount > 0) {
    const seedBySlot = new Map([...slotBySeed].map(([seed, slot]) => [slot, seed]));
    placed.filter((entry) => entry.seed > previousCount).forEach((entry) => {
      const pairedSlot = entry.slot % 2 === 0 ? entry.slot + 1 : entry.slot - 1;
      const hasOpponent = (seedBySlot.get(pairedSlot) ?? Infinity) <= totalEntrants;
      if (!hasOpponent) {
        score += entry.rankIndex * 2e4;
      }
    });
  }
  return score;
}
function buildIpingCompatibleSeedOrder(rankedPools) {
  const rankCount = rankedPools[0]?.length ?? 0;
  if (rankCount < 1 || rankedPools.some((pool) => pool.length !== rankCount || pool.some((unit) => !unit.id))) return null;
  const labels = buildIpingSlotLabels(rankedPools.length, rankCount);
  if (labels === null) return null;
  const slots = labels.length === 0 ? ["1-1", "BYE"] : labels;
  const internalSeeds = seededBracket(slots.length);
  const result = Array(slots.length);
  slots.forEach((label, slotIndex) => {
    const [groupNumber, rankNumber] = label.split("-").map(Number);
    const unit = rankedPools[groupNumber - 1]?.[rankNumber - 1];
    result[internalSeeds[slotIndex] - 1] = unit ?? { id: null, name: null, division: null };
  });
  return result;
}
function buildCrossGroupTournamentSeedOrder(rankedPools) {
  const labeledPools = rankedPools.map(
    (pool, poolIndex) => pool.map((unit, rankIndex) => ({
      ...unit,
      seedLabel: unit.id ? `${poolIndex + 1}-${rankIndex + 1}` : void 0
    }))
  );
  const ipingOrder = buildIpingCompatibleSeedOrder(labeledPools);
  if (ipingOrder) return ipingOrder;
  const exactTwoGroupOrder = buildTwoGroupOfficialSeedOrder(labeledPools);
  if (exactTwoGroupOrder) return exactTwoGroupOrder;
  const rankedTiers = Array.from(
    { length: Math.max(...labeledPools.map((pool) => pool.length)) },
    (_, rankIndex) => labeledPools.flatMap((pool, poolIndex) => {
      const unit = pool[rankIndex];
      return unit?.id ? [{ unit, poolIndex, rankIndex }] : [];
    })
  ).filter((tier) => tier.length > 0);
  const totalEntrants = rankedTiers.reduce((sum, tier) => sum + tier.length, 0);
  if (totalEntrants === 0) return [];
  const bracketSize = 2 ** Math.ceil(Math.log2(Math.max(2, totalEntrants)));
  const maxRank = rankedTiers.length;
  const slotBySeed = new Map(officialSeedLineOrder(bracketSize).map((seed, slot) => [seed, slot]));
  let candidates = [{ order: [], score: 0 }];
  rankedTiers.forEach((tier, tierIndex) => {
    const variants = buildRankOrderVariants(tier).filter((variant) => tierIndex !== 0 || variant[0].poolIndex === tier[0].poolIndex && (tier.length < 2 || variant[1].poolIndex === tier[1].poolIndex));
    const nextCandidates = candidates.flatMap(
      (candidate) => variants.map((variant) => {
        const order = [...candidate.order, ...variant];
        return {
          order,
          score: scoreCrossGroupSeedOrder(
            order,
            totalEntrants,
            bracketSize,
            maxRank,
            candidate.order.length,
            candidate.score,
            slotBySeed
          )
        };
      })
    );
    nextCandidates.sort((left, right) => left.score - right.score);
    candidates = nextCandidates.slice(0, 32);
  });
  const selected = (candidates[0]?.order ?? rankedTiers.flat()).map(({ unit }) => unit);
  const slotSeeds = officialSeedLineOrder(bracketSize);
  const internalSeeds = seededBracket(bracketSize);
  const seedOrder = Array(bracketSize);
  slotSeeds.forEach((seed, slotIndex) => {
    seedOrder[internalSeeds[slotIndex] - 1] = selected[seed - 1] ?? { id: null, name: null, division: null };
  });
  return seedOrder;
}
function balancedSizes(total, preferredGroupCount) {
  const groupCount = Math.max(1, Math.min(preferredGroupCount, total));
  return Array.from(
    { length: groupCount },
    (_, index) => Math.floor(total / groupCount) + (index < total % groupCount ? 1 : 0)
  );
}
function buildTeamFormationSizes(total, teamPlayerCount) {
  if (total <= 0) return [];
  if (total < 4) return [total];
  const preferredSize = Math.max(2, teamPlayerCount);
  const teamCount = Math.max(1, Math.min(Math.floor(total / 2), Math.ceil(total / preferredSize)));
  return Array.from(
    { length: teamCount },
    (_, index) => Math.floor(total / teamCount) + (index < total % teamCount ? 1 : 0)
  );
}
function distributeQualifiedPoolsToFinalGroups(pools, advanceCount, preferredGroupCount) {
  const groupCount = Math.max(1, Math.min(preferredGroupCount, pools.length));
  const finalGroups = Array.from({ length: groupCount }, () => []);
  const crossSeededPools = [];
  for (let left = 0, right = pools.length - 1; left <= right; left += 1, right -= 1) {
    crossSeededPools.push(pools[left]);
    if (left !== right) crossSeededPools.push(pools[right]);
  }
  const poolGroupSizes = balancedSizes(crossSeededPools.length, groupCount);
  const poolChunks = [];
  let poolOffset = 0;
  poolGroupSizes.forEach((poolCount) => {
    poolChunks.push(crossSeededPools.slice(poolOffset, poolOffset + poolCount));
    poolOffset += poolCount;
  });
  for (let rankIndex = 0; rankIndex < advanceCount; rankIndex += 1) {
    poolChunks.forEach((chunk, chunkIndex) => {
      const destinationIndex = (chunkIndex + rankIndex) % groupCount;
      chunk.forEach((pool) => {
        if (pool[rankIndex]) finalGroups[destinationIndex].push(pool[rankIndex]);
      });
    });
  }
  return finalGroups;
}
function buildRankPlaceholderPools(groupSizes, maxRank, labels) {
  return groupSizes.map(
    (size, groupIndex) => Array.from({ length: Math.min(size, maxRank ?? size) }, (_, rankIndex) => ({
      id: `placeholder-${groupIndex + 1}-${rankIndex + 1}`,
      name: `${labels?.[groupIndex] ?? `${groupIndex + 1}\uC870`} ${rankIndex + 1}\uC704`,
      division: null,
      level: rankIndex + 1,
      seedLabel: `${groupIndex + 1}-${rankIndex + 1}`
    }))
  );
}
function buildSingleLeagueRankPlaceholderPool(participantCount, maxRank) {
  const placeholders = Array.from(
    { length: Math.min(participantCount, maxRank ?? participantCount) },
    (_, index) => ({
      id: `placeholder-rank-${index + 1}`,
      name: `${index + 1}\uC704`,
      division: null,
      level: index + 1,
      seedLabel: String(index + 1)
    })
  );
  return [placeholders];
}
function buildTournamentRankPlaceholderPool(sourceRound, advanceCount) {
  return [Array.from({ length: advanceCount }, (_, index) => ({
    id: `placeholder-tournament-r${sourceRound}-rank-${index + 1}`,
    name: `${sourceRound}\uB77C\uC6B4\uB4DC ${index + 1}\uC704`,
    division: null,
    level: index + 1,
    seedLabel: String(index + 1)
  }))];
}
function getTournamentWinner(match) {
  if (match.status !== "done") return null;
  const scoreA = match.score_a;
  const scoreB = match.score_b;
  const hasScoreA = typeof scoreA === "number";
  const hasScoreB = typeof scoreB === "number";
  const winnerSlot = hasScoreA && hasScoreB && scoreA !== scoreB ? scoreA > scoreB ? "a" : "b" : match.participant_a_id && !match.participant_b_id ? "a" : match.participant_b_id && !match.participant_a_id ? "b" : null;
  if (!winnerSlot) return null;
  return winnerSlot === "a" ? {
    id: match.participant_a_id,
    name: match.participant_a_name,
    division: match.participant_a_division,
    seedLabel: match.participant_a_seed_label ?? void 0
  } : {
    id: match.participant_b_id,
    name: match.participant_b_name,
    division: match.participant_b_division,
    seedLabel: match.participant_b_seed_label ?? void 0
  };
}
function getTournamentLoser(match) {
  const winner = getTournamentWinner(match);
  if (!winner) return null;
  return winner.id === match.participant_a_id ? {
    id: match.participant_b_id,
    name: match.participant_b_name,
    division: match.participant_b_division,
    seedLabel: match.participant_b_seed_label ?? void 0
  } : {
    id: match.participant_a_id,
    name: match.participant_a_name,
    division: match.participant_a_division,
    seedLabel: match.participant_a_seed_label ?? void 0
  };
}
function applyProgramTournamentAdvancement(matches) {
  const matchMap = new Map(matches.map((match) => [match.id, { ...match }]));
  const orderedMatches = [...matchMap.values()].sort((a, b) => (a.round_number ?? 0) - (b.round_number ?? 0));
  const inboundSourceIds = /* @__PURE__ */ new Map();
  matches.forEach((source) => {
    [source.next_match_id, source.loser_next_match_id].forEach((targetId) => {
      if (!targetId) return;
      inboundSourceIds.set(targetId, [...inboundSourceIds.get(targetId) ?? [], source.id]);
    });
  });
  orderedMatches.forEach((orderedMatch) => {
    const match = matchMap.get(orderedMatch.id) ?? orderedMatch;
    const hasOnlyOneParticipant = Boolean(match.participant_a_name) !== Boolean(match.participant_b_name);
    const sources = inboundSourceIds.get(match.id) ?? [];
    const allSourcesResolved = sources.length === 2 && sources.every((sourceId) => matchMap.get(sourceId)?.status === "done");
    if (match.bracket !== "lower" && match.status !== "done" && hasOnlyOneParticipant && allSourcesResolved) {
      if (!match.participant_a_name) match.participant_a_id = null;
      if (!match.participant_b_name) match.participant_b_id = null;
      match.status = "done";
      match.score_a = match.participant_a_id ? 0 : null;
      match.score_b = match.participant_b_id ? 0 : null;
    }
    const winner = getTournamentWinner(match);
    if (winner && match.next_match_id && match.next_slot) {
      const parent = matchMap.get(match.next_match_id);
      if (parent && match.next_slot === "a" && !parent.participant_a_name) {
        parent.participant_a_id = winner.id;
        parent.participant_a_name = winner.name;
        parent.participant_a_division = winner.division;
        parent.participant_a_seed_label = winner.seedLabel;
      } else if (parent && match.next_slot === "b" && !parent.participant_b_name) {
        parent.participant_b_id = winner.id;
        parent.participant_b_name = winner.name;
        parent.participant_b_division = winner.division;
        parent.participant_b_seed_label = winner.seedLabel;
      }
    }
    const loser = getTournamentLoser(match);
    if (loser && match.loser_next_match_id && match.loser_next_slot) {
      const parent = matchMap.get(match.loser_next_match_id);
      if (parent && match.loser_next_slot === "a" && !parent.participant_a_name) {
        parent.participant_a_id = loser.id;
        parent.participant_a_name = loser.name;
        parent.participant_a_division = loser.division;
        parent.participant_a_seed_label = loser.seedLabel;
      } else if (parent && match.loser_next_slot === "b" && !parent.participant_b_name) {
        parent.participant_b_id = loser.id;
        parent.participant_b_name = loser.name;
        parent.participant_b_division = loser.division;
        parent.participant_b_seed_label = loser.seedLabel;
      }
    }
  });
  return matches.map((match) => matchMap.get(match.id) ?? match);
}
function generateProgramRoundMatches(leagueId, option, participants, round, sourceMatches = []) {
  const storedBlock = option?.blocks?.[round - 1];
  const currentRound = option?.rounds?.[round - 1];
  if (!storedBlock || participants.length < 2) return [];
  const previousRound = round > 1 ? option?.rounds?.[round - 2] : void 0;
  const previousTeamBlock = round > 1 ? option?.blocks?.[round - 2] : void 0;
  const inheritsPreviousTeamFormation = storedBlock.type === "TEAM" && (currentRound?.inheritPreviousTeamFormation ?? storedBlock.inheritPreviousTeamFormation) && previousTeamBlock?.type === "TEAM";
  const block = {
    ...storedBlock,
    groupSizes: currentRound?.groupSizes ?? storedBlock.groupSizes,
    teamGroupSizes: currentRound?.teamGroupSizes ?? storedBlock.teamGroupSizes,
    teamPlayerCount: inheritsPreviousTeamFormation ? previousRound?.teamPlayerCount ?? previousTeamBlock?.teamPlayerCount : currentRound?.teamPlayerCount ?? storedBlock.teamPlayerCount,
    teamFormationSizes: inheritsPreviousTeamFormation ? previousRound?.teamFormationSizes ?? previousTeamBlock?.teamFormationSizes : currentRound?.teamFormationSizes ?? storedBlock.teamFormationSizes,
    groupShuffleSeed: currentRound?.groupShuffleSeed ?? storedBlock.groupShuffleSeed,
    groupAssignments: currentRound?.groupAssignments ?? storedBlock.groupAssignments,
    teamAssignments: inheritsPreviousTeamFormation ? previousRound?.teamAssignments ?? previousTeamBlock?.teamAssignments : currentRound?.teamAssignments ?? storedBlock.teamAssignments,
    doublesAssignments: currentRound?.doublesAssignments ?? storedBlock.doublesAssignments,
    teamShuffleSeed: inheritsPreviousTeamFormation ? previousRound?.teamShuffleSeed ?? previousTeamBlock?.teamShuffleSeed : currentRound?.teamShuffleSeed ?? storedBlock.teamShuffleSeed,
    unitClubMode: inheritsPreviousTeamFormation ? previousRound?.unitClubMode ?? previousTeamBlock?.unitClubMode : currentRound?.unitClubMode ?? storedBlock.unitClubMode,
    halfSplitOnlyMatches: currentRound?.halfSplitOnlyMatches ?? storedBlock.halfSplitOnlyMatches,
    participantOrder: currentRound?.participantOrder ?? storedBlock.participantOrder,
    halfSplitMatchOrder: currentRound?.halfSplitMatchOrder ?? storedBlock.halfSplitMatchOrder,
    restoredMatchIds: currentRound?.restoredMatchIds ?? storedBlock.restoredMatchIds
  };
  const deletedMatchIds = new Set(block.deletedMatchIds ?? []);
  const restoredMatchIds = new Set(block.restoredMatchIds ?? []);
  const withoutDeleted = (matches) => matches.filter((match) => !deletedMatchIds.has(match.id)).map((match) => ({
    ...match,
    is_no_game: restoredMatchIds.has(match.id) ? false : match.is_no_game,
    is_program: true,
    program_round: round,
    program_block_type: block.type
  }));
  let players = toProgramPlayers(participants);
  const storedBlueWhiteOrder = block.halfSplitMatchOrder?.length ? block.halfSplitMatchOrder : block.participantOrder?.length ? block.participantOrder : option?.blocks?.find(
    (candidate) => candidate.competitionMode === "blue-white" && (candidate.halfSplitMatchOrder?.length || candidate.participantOrder?.length)
  )?.halfSplitMatchOrder ?? option?.blocks?.find(
    (candidate) => candidate.competitionMode === "blue-white" && candidate.participantOrder?.length
  )?.participantOrder;
  const inferredBlueWhiteSplit = storedBlueWhiteOrder?.length ? Math.ceil(storedBlueWhiteOrder.length / 2) : 0;
  const blueWhiteTeams = resolveProgramBlueWhiteTeams(option, block) ?? (inferredBlueWhiteSplit > 0 ? {
    blueParticipantIds: storedBlueWhiteOrder.slice(0, inferredBlueWhiteSplit),
    whiteParticipantIds: storedBlueWhiteOrder.slice(inferredBlueWhiteSplit)
  } : void 0);
  if (block.competitionMode === "blue-white" && blueWhiteTeams) {
    const blueOrder = new Map(blueWhiteTeams.blueParticipantIds.map((id, index) => [id, index]));
    const whiteOrder = new Map(blueWhiteTeams.whiteParticipantIds.map((id, index) => [id, index]));
    players = [...players].sort((left, right) => {
      const leftBlue = blueOrder.get(left.id);
      const rightBlue = blueOrder.get(right.id);
      const leftWhite = whiteOrder.get(left.id);
      const rightWhite = whiteOrder.get(right.id);
      const leftSide = leftBlue != null ? 0 : leftWhite != null ? 1 : 2;
      const rightSide = rightBlue != null ? 0 : rightWhite != null ? 1 : 2;
      if (leftSide !== rightSide) return leftSide - rightSide;
      return (leftBlue ?? leftWhite ?? Number.MAX_SAFE_INTEGER) - (rightBlue ?? rightWhite ?? Number.MAX_SAFE_INTEGER);
    });
  }
  const defaultFormationSeed = round * 1e3;
  const teamFormationPlayers = block.competitionMode === "blue-white" && blueWhiteTeams ? [
    ...shuffleWithinLevel(players.filter((player) => blueWhiteTeams.blueParticipantIds.includes(player.id)), block.teamShuffleSeed ?? defaultFormationSeed + 101),
    ...shuffleWithinLevel(players.filter((player) => blueWhiteTeams.whiteParticipantIds.includes(player.id)), block.teamShuffleSeed ?? defaultFormationSeed + 201)
  ] : shuffleWithinLevel(players, block.teamShuffleSeed ?? defaultFormationSeed + 101);
  const groupSizes = block.groupSizes?.length ? block.groupSizes : option?.groupSizes ?? [players.length];
  const teamFormationSizes = block.teamFormationSizes?.length ? block.teamFormationSizes : buildTeamFormationSizes(players.length, block.teamPlayerCount ?? 4);
  let matchUnits = block.type === "TEAM" ? block.teamAssignments?.length ? teamUnitsFromAssignments(block.teamAssignments, players) : toTeamUnitsFromGroupSizes(teamFormationPlayers, teamFormationSizes, block.unitClubMode ?? "mixed") : block.type === "DOUBLES" ? toDoublesUnits(players, block.doublesAssignments, block.unitClubMode ?? "mixed") : players;
  const matchUnitOrder = block.halfSplitOnlyMatches ? block.halfSplitMatchOrder : block.participantOrder;
  if (matchUnitOrder?.length) {
    const order = new Map(matchUnitOrder.map((id, index) => [id, index]));
    matchUnits = [...matchUnits].sort(
      (left, right) => ((left.id ? order.get(left.id) : void 0) ?? Number.MAX_SAFE_INTEGER) - ((right.id ? order.get(right.id) : void 0) ?? Number.MAX_SAFE_INTEGER)
    );
  }
  if (matchUnits.length < 2) {
    return [];
  }
  const isFinalRound = round > 1 && (currentRound?.option === "FINAL" || block.roundOption === "FINAL" || block.title.includes("\uBCF8\uC120"));
  const sourceRound = block.sourceRoundId ?? round - 1;
  const previousBlock = option?.blocks?.[sourceRound - 1];
  const refreshedSourceSnapshot = isFinalRound ? buildProgramRoundStandingsSnapshot(option, sourceRound, sourceMatches) : null;
  const standingsOption = refreshedSourceSnapshot?.complete ? {
    ...option,
    roundStandings: [
      ...(option?.roundStandings ?? []).filter((snapshot) => snapshot.round !== sourceRound),
      refreshedSourceSnapshot
    ]
  } : option;
  const rankedPools = isFinalRound ? getSavedRankedUnitPools(standingsOption, sourceRound, matchUnits) : null;
  const finalMode = block.finalAdvancementMode ?? "top-n";
  const advanceCount = Math.max(1, block.advanceCount ?? 2);
  const advancesEveryone = finalMode === "all" || finalMode === "rank-groups";
  const tournamentBuilder = block.tournamentMode === "upper-lower" ? buildUpperLowerTournamentMatches : buildTournamentMatches;
  const previousGroupSizes = previousBlock?.groupSizes ?? option?.groupSizes ?? [];
  const isBlueWhiteTeamRankSource = previousBlock?.competitionMode === "blue-white" && previousBlock.blueWhiteRankingMode === "by-team" && Boolean(blueWhiteTeams);
  const isBlueWhiteSeparatedTournamentSource = previousBlock?.format === "TOURNAMENT" && previousBlock.competitionMode === "blue-white" && previousBlock.blueWhiteTournamentPlacement === "by-team";
  const placeholderPools = isFinalRound && !rankedPools ? previousBlock?.format === "GROUP" && previousGroupSizes.length > 0 ? buildRankPlaceholderPools(previousGroupSizes) : previousBlock?.format === "LEAGUE" ? isBlueWhiteTeamRankSource && blueWhiteTeams ? buildRankPlaceholderPools(
    [blueWhiteTeams.blueParticipantIds.length, blueWhiteTeams.whiteParticipantIds.length],
    void 0,
    ["\uCCAD\uD300", "\uBC31\uD300"]
  ) : buildSingleLeagueRankPlaceholderPool(matchUnits.length) : previousBlock?.format === "TOURNAMENT" ? isBlueWhiteSeparatedTournamentSource ? buildRankPlaceholderPools([1, 1], 1, ["\uCCAD\uD300", "\uBC31\uD300"]) : buildTournamentRankPlaceholderPool(sourceRound, advanceCount) : null : null;
  const finalPools = rankedPools ?? placeholderPools;
  const selectedFinalUnits = finalPools ? advancesEveryone ? finalPools.flat() : Array.from({ length: advanceCount }, (_, rankIndex) => rankIndex).flatMap(
    (rankIndex) => finalPools.flatMap((pool) => pool[rankIndex] ? [pool[rankIndex]] : [])
  ) : [];
  if (block.format === "TOURNAMENT") {
    if (isFinalRound) {
      const bracketCount = block.tournamentBracketCount ?? 1;
      const isBlueWhiteChampionship = block.competitionMode === "blue-white" && round >= 3 && (currentRound?.option === "FINAL" || block.roundOption === "FINAL");
      const qualifiedPools = finalPools?.map(
        (pool) => (isBlueWhiteChampionship ? pool.slice(0, 1) : advancesEveryone ? pool : pool.slice(0, advanceCount)).map(
          (unit) => unit.isBot ? { id: null, name: null, division: null, isBot: true } : unit
        )
      );
      if (block.competitionMode === "blue-white" && block.blueWhiteTournamentPlacement === "by-team" && blueWhiteTeams && qualifiedPools?.length) {
        if (isBlueWhiteTeamRankSource && qualifiedPools.length >= 2) {
          return withoutDeleted(qualifiedPools.slice(0, 2).flatMap(
            (bracketPlayers, bracketIndex) => tournamentBuilder(
              leagueId,
              round - 1,
              block,
              bracketPlayers,
              "seed",
              bracketIndex + 1
            )
          ));
        }
        const blueIds = new Set(blueWhiteTeams.blueParticipantIds);
        const whiteIds = new Set(blueWhiteTeams.whiteParticipantIds);
        const blueUnits = [];
        const whiteUnits = [];
        const unassignedUnits = [];
        qualifiedPools.flat().forEach((unit) => {
          const memberIds = unit.id?.split("+").filter(Boolean) ?? [];
          if (memberIds.length > 0 && memberIds.every((participantId) => blueIds.has(participantId))) {
            blueUnits.push(unit);
          } else if (memberIds.length > 0 && memberIds.every((participantId) => whiteIds.has(participantId))) {
            whiteUnits.push(unit);
          } else {
            unassignedUnits.push(unit);
          }
        });
        unassignedUnits.forEach((unit) => {
          (blueUnits.length <= whiteUnits.length ? blueUnits : whiteUnits).push(unit);
        });
        const teamBrackets = [blueUnits, whiteUnits].filter((units) => units.length > 0);
        return withoutDeleted(teamBrackets.flatMap(
          (bracketPlayers, bracketIndex) => tournamentBuilder(
            leagueId,
            round - 1,
            block,
            bracketPlayers,
            finalPools ? "seed" : void 0,
            bracketIndex + 1
          )
        ));
      }
      const crossGroupSeedOrder = bracketCount === 1 && qualifiedPools ? buildCrossGroupTournamentSeedOrder(qualifiedPools) : null;
      const tournamentBrackets = crossGroupSeedOrder?.length ? [crossGroupSeedOrder] : qualifiedPools?.length ? distributeRankedUnitPoolsToBrackets(qualifiedPools, bracketCount) : [];
      return withoutDeleted(tournamentBrackets.flatMap(
        (bracketPlayers, bracketIndex) => tournamentBuilder(
          leagueId,
          round - 1,
          block,
          bracketPlayers,
          finalPools ? "seed" : void 0,
          bracketIndex + 1
        )
      ));
    }
    const tournamentUnits = block.competitionMode === "blue-white" && block.blueWhiteTournamentPlacement === "by-team" ? [
      matchUnits.slice(0, Math.ceil(matchUnits.length / 2)),
      matchUnits.slice(Math.ceil(matchUnits.length / 2))
    ].filter((units) => units.length > 0) : splitTournamentUnits(matchUnits, block.tournamentBracketCount ?? 1);
    if (block.tournamentStartSize && tournamentUnits.some((bracketPlayers, index) => buildTournamentSlots(leagueId, round - 1, block, bracketPlayers, void 0, index + 1).length === 0)) return [];
    return withoutDeleted(tournamentUnits.flatMap(
      (bracketPlayers, bracketIndex) => tournamentBuilder(leagueId, round - 1, block, bracketPlayers, void 0, bracketIndex + 1)
    ));
  }
  if (block.format === "LEAGUE") {
    if (isFinalRound) {
      if (selectedFinalUnits.length < 2) return [];
      return withoutDeleted(buildUnitRoundRobinMatches(
        leagueId,
        round - 1,
        block,
        selectedFinalUnits
      ));
    }
    return withoutDeleted(buildUnitRoundRobinMatches(leagueId, round - 1, block, matchUnits));
  }
  if (block.format === "GROUP") {
    if (isFinalRound) {
      if (!finalPools) return [];
      let finalGroups = [];
      const expectedRankGroupCount = finalMode === "rank-groups" ? Math.max(0, ...finalPools.map((pool) => pool.length)) : null;
      const customizedAssignedGroups = block.groupAssignments?.length ? assignedMatchUnits(block.groupAssignments, selectedFinalUnits) : [];
      const customizedAssignedUnitCount = customizedAssignedGroups.reduce(
        (sum, groupPlayers) => sum + groupPlayers.length,
        0
      );
      const hasCompleteCustomizedFormation = Boolean(
        block.groupFormationCustomized && block.groupFormationSchemaVersion === 2 && block.groupAssignments?.length && customizedAssignedUnitCount === selectedFinalUnits.length
      );
      if (hasCompleteCustomizedFormation && block.groupAssignments) {
        finalGroups = customizedAssignedGroups.map((groupPlayers, index) => ({
          name: finalMode === "rank-groups" ? `${index + 1}\uC704\uC870` : `${index + 1}\uC870`,
          players: groupPlayers
        })).filter((group) => group.players.length > 0);
      } else if (finalMode === "upper-lower-groups") {
        const upper = finalPools.flatMap((pool) => pool.slice(0, Math.ceil(pool.length / 2)));
        const lower = finalPools.flatMap((pool) => pool.slice(Math.ceil(pool.length / 2)));
        finalGroups = [
          { name: "\uC0C1\uC704\uBD80", players: upper },
          { name: "\uD558\uC704\uBD80", players: lower }
        ].filter((group) => group.players.length > 1);
      } else if (finalMode === "rank-groups") {
        finalGroups = Array.from({ length: expectedRankGroupCount ?? 0 }, (_, rankIndex) => ({
          name: `${rankIndex + 1}\uC704\uC870`,
          players: finalPools.flatMap((pool, poolIndex) => pool[rankIndex] ? [{ ...pool[rankIndex], seedLabel: `${poolIndex + 1}-${rankIndex + 1}` }] : [])
        })).filter((group) => group.players.length > 1);
      } else {
        const preferredGroupCount = Math.max(1, block.groupSizes?.length ?? finalPools.length);
        finalGroups = distributeQualifiedPoolsToFinalGroups(
          finalPools,
          advanceCount,
          preferredGroupCount
        ).map((players2, index) => ({
          name: `${index + 1}\uC870`,
          players: players2
        }));
      }
      return withoutDeleted(finalGroups.flatMap(
        (group) => buildUnitRoundRobinMatches(
          leagueId,
          round - 1,
          block,
          group.players,
          group.name
        )
      ).map((match, index) => ({ ...match, match_order: index + 1 })));
    }
    const shuffledUnits = shuffleWithinLevel(matchUnits, block.groupShuffleSeed ?? defaultFormationSeed + 503);
    const configuredGroupSizes = block.type === "TEAM" ? block.teamGroupSizes?.length ? block.teamGroupSizes : [Math.ceil(matchUnits.length / 2), Math.floor(matchUnits.length / 2)].filter((size) => size > 0) : block.type === "DOUBLES" && groupSizes.reduce((sum, size) => sum + size, 0) !== matchUnits.length ? balancedSizes(matchUnits.length, Math.min(2, matchUnits.length)) : groupSizes;
    const canUseSavedGroupAssignments = Boolean(
      block.groupAssignments?.length && (block.finalAdvancementMode !== "rank-groups" || block.groupFormationCustomized && block.groupFormationSchemaVersion === 2)
    );
    const savedGroupAssignments = block.groupAssignments ?? [];
    const groups = canUseSavedGroupAssignments ? block.type === "DOUBLES" || block.type === "TEAM" ? assignedTeamGroups(savedGroupAssignments, matchUnits).map((groupPlayers, index) => ({ name: `${index + 1}\uC870`, players: groupPlayers })) : assignedPlayers(savedGroupAssignments, players).map((groupPlayers, index) => ({ name: `${index + 1}\uC870`, players: groupPlayers })) : block.crossClubGrouping ? distributeClubAware(shuffledUnits, configuredGroupSizes).map((groupPlayers, index) => ({ name: `${index + 1}\uC870`, players: groupPlayers })) : distributeSnake(shuffledUnits, configuredGroupSizes).map((group, index) => ({
      name: `${index + 1}\uC870`,
      players: group.players
    }));
    return withoutDeleted(groups.flatMap(
      (group, groupIndex) => buildUnitRoundRobinMatches(
        leagueId,
        round - 1,
        block,
        group.players,
        group.name ?? `${groupIndex + 1}\uC870`
      ).map((match, index) => ({
        ...match,
        id: `${match.id}-${index + 1}`,
        match_order: index + 1
      }))
    ).map((match, index) => ({ ...match, match_order: index + 1 })));
  }
  return [];
}

// 3ch-web/src/features/league/algorithms/calculateDuration.ts
function getMatchDuration(rule) {
  switch (rule) {
    case "3\uC804 2\uC120\uC2B9\uC81C":
      return 20;
    case "3\uC138\uD2B8\uC81C":
      return 25;
    case "5\uC804 3\uC120\uC2B9\uC81C":
      return 35;
    default:
      return 20;
  }
}
function calculateDuration(matchCount, courtCount, rule) {
  const slotMinutes = getMatchDuration(rule);
  const rounds = Math.ceil(
    matchCount / courtCount
  );
  return rounds * slotMinutes;
}

// 3ch-web/src/features/league/algorithms/calculateMatchCount.ts
function calculateRoundRobinMatchCount(playerCount) {
  return playerCount * (playerCount - 1) / 2;
}
function calculateGroupMatchCount(groupSizes) {
  return groupSizes.reduce((total, size) => {
    return total + calculateRoundRobinMatchCount(size);
  }, 0);
}

// 3ch-web/src/features/league/algorithms/calculateTeamMatchCount.ts
function calculateTeamLeagueMatchCount(teamCount) {
  return teamCount * (teamCount - 1) / 2;
}
function calculateTeamCount(playerCount, teamSize) {
  return Math.ceil(
    playerCount / teamSize
  );
}
function calculateTeamGroupMatchCount(groupSizes) {
  return groupSizes.reduce(
    (total, size) => total + size * (size - 1) / 2,
    0
  );
}

// 3ch-web/src/features/league/algorithms/generateProgramBlocks.ts
function getOptionLabel(option, roundIndex) {
  switch (option) {
    case "PRELIM":
      return "\uC608\uC120";
    case "FINAL":
      return roundIndex >= 2 ? "\uACB0\uC120" : "\uBCF8\uC120";
    case "UPPER":
      return "\uC0C1\uC704";
    case "LOWER":
      return "\uD558\uC704";
    default:
      return "";
  }
}
function getMatchRuleLabel(matchRule) {
  switch (matchRule) {
    case "BEST_OF_5":
      return "5\uC804 3\uC120\uC2B9\uC81C";
    case "THREE_SET":
      return "3\uC138\uD2B8\uC81C";
    default:
      return "3\uC804 2\uC120\uC2B9\uC81C";
  }
}
function splitIntoTwoGroups(count) {
  if (count <= 0) return [];
  if (count <= 2) return [count];
  return [Math.ceil(count / 2), Math.floor(count / 2)];
}
function splitBalanced(count, preferredGroupCount) {
  const groupCount = Math.max(1, Math.min(preferredGroupCount, Math.max(1, Math.floor(count / 2))));
  return Array.from(
    { length: groupCount },
    (_, index) => Math.floor(count / groupCount) + (index < count % groupCount ? 1 : 0)
  ).filter((size) => size > 0);
}
function calculateMultipleTournamentMatchCount(count, bracketCount = 1, thirdPlaceMatch = false, startSize) {
  if (startSize) count = Math.min(count, startSize * Math.max(1, bracketCount));
  const effectiveBracketCount = Math.min(Math.max(1, bracketCount), count);
  const baseMatchCount = Math.max(0, count - effectiveBracketCount);
  if (!thirdPlaceMatch) return baseMatchCount;
  const bracketsWithSemifinals = Array.from(
    { length: effectiveBracketCount },
    (_, index) => Math.floor(count / effectiveBracketCount) + (index < count % effectiveBracketCount ? 1 : 0)
  ).filter((size) => size >= 4).length;
  return baseMatchCount + bracketsWithSemifinals;
}
function generateProgramBlocks(preferences, playerCount, courtCount, groupSizes) {
  const doublesMatchCount = Math.floor(playerCount * 0.75);
  function getTeamMatchInfo(teamMatchType) {
    switch (teamMatchType) {
      case "SSS":
        return {
          singles: 3,
          doubles: 0,
          description: "\uB2E8\uC2DD / \uB2E8\uC2DD / \uB2E8\uC2DD"
        };
      case "SDS":
        return {
          singles: 2,
          doubles: 1,
          description: "\uB2E8\uC2DD / \uBCF5\uC2DD / \uB2E8\uC2DD"
        };
      case "DSD":
        return {
          singles: 1,
          doubles: 2,
          description: "\uBCF5\uC2DD / \uB2E8\uC2DD / \uBCF5\uC2DD"
        };
      case "DDD":
        return {
          singles: 0,
          doubles: 3,
          description: "\uBCF5\uC2DD / \uBCF5\uC2DD / \uBCF5\uC2DD"
        };
      default:
        return {
          singles: 3,
          doubles: 0,
          description: "\uB2E8\uC2DD / \uB2E8\uC2DD / \uB2E8\uC2DD"
        };
    }
  }
  const blocks = [];
  const rounds = preferences.rounds ?? [];
  const effectiveGroupSizesByRound = [];
  for (const [roundIndex, configuredRound] of rounds.entries()) {
    const previousRound = roundIndex > 0 ? rounds[roundIndex - 1] : void 0;
    const round = configuredRound.program === "TEAM" && configuredRound.inheritPreviousTeamFormation && previousRound?.program === "TEAM" ? {
      ...configuredRound,
      teamPlayerCount: previousRound.teamPlayerCount,
      teamAssignments: previousRound.teamAssignments,
      teamShuffleSeed: previousRound.teamShuffleSeed,
      unitClubMode: previousRound.unitClubMode
    } : configuredRound;
    const configuredGroupSizes = round.groupSizes ?? groupSizes;
    const sourceRoundIndex = round.option === "FINAL" ? Math.max(0, (round.sourceRoundId ?? roundIndex) - 1) : -1;
    const sourceRound = sourceRoundIndex >= 0 ? rounds[sourceRoundIndex] : void 0;
    const sourceGroupSizes = sourceRoundIndex >= 0 ? effectiveGroupSizesByRound[sourceRoundIndex] ?? sourceRound?.groupSizes ?? groupSizes : [];
    const isSinglesFinal = round.program === "SINGLES" && round.option === "FINAL" && sourceRound?.program === "SINGLES";
    const finalSinglesCount = isSinglesFinal ? sourceRound?.format === "GROUP" ? round.finalAdvancementMode === "all" ? sourceGroupSizes.reduce((sum, size) => sum + size, 0) : sourceGroupSizes.reduce((sum, size) => sum + Math.min(size, Math.max(1, round.advanceCount ?? 2)), 0) : round.finalAdvancementMode === "all" ? playerCount : Math.min(playerCount, Math.max(1, round.advanceCount ?? 2)) : playerCount;
    const roundGroupSizes = isSinglesFinal && round.format === "GROUP" ? splitBalanced(finalSinglesCount, configuredGroupSizes.length) : configuredGroupSizes;
    effectiveGroupSizesByRound.push(roundGroupSizes);
    const isBlueWhiteChampionship = round.competitionMode === "blue-white" && roundIndex >= 2 && round.option === "FINAL" && round.format === "TOURNAMENT";
    const effectiveTournamentBracketCount = isBlueWhiteChampionship ? 1 : round.tournamentBracketCount;
    const effectiveThirdPlaceMatch = isBlueWhiteChampionship ? false : round.thirdPlaceMatch;
    if (round.program === "SINGLES") {
      let matchCount = 0;
      if (round.format === "LEAGUE") {
        matchCount = calculateRoundRobinMatchCount(
          isSinglesFinal ? finalSinglesCount : playerCount
        );
      }
      if (round.format === "GROUP") {
        matchCount = calculateGroupMatchCount(
          roundGroupSizes
        );
      }
      if (round.format === "TOURNAMENT") {
        matchCount = calculateMultipleTournamentMatchCount(isSinglesFinal ? finalSinglesCount : playerCount, effectiveTournamentBracketCount, effectiveThirdPlaceMatch, round.option !== "FINAL" ? round.tournamentStartSize : void 0);
      }
      const duration = calculateDuration(
        matchCount,
        courtCount,
        getMatchRuleLabel(round.matchRule)
      );
      blocks.push({
        title: `${blocks.length + 1}\uB77C\uC6B4\uB4DC ${getOptionLabel(round.option, roundIndex)} \uB2E8\uC2DD`,
        roundOption: round.option,
        type: "SINGLES",
        matchRule: getMatchRuleLabel(round.matchRule),
        nextMatchRule: round.nextMatchRule ? getMatchRuleLabel(round.nextMatchRule) : void 0,
        ruleSwitchSize: round.ruleSwitchSize,
        lateMatchRule: round.lateMatchRule ? getMatchRuleLabel(round.lateMatchRule) : void 0,
        lowerMatchRule: round.lowerMatchRule ? getMatchRuleLabel(round.lowerMatchRule) : void 0,
        lowerRuleSwitchSize: round.lowerRuleSwitchSize,
        lowerLateMatchRule: round.lowerLateMatchRule ? getMatchRuleLabel(round.lowerLateMatchRule) : void 0,
        format: round.format,
        expectedMinutes: duration,
        matchCount,
        groupSizes: roundGroupSizes,
        groupShuffleSeed: round.groupShuffleSeed,
        teamShuffleSeed: round.teamShuffleSeed,
        groupAssignments: round.groupAssignments,
        teamAssignments: round.teamAssignments,
        tournamentBracketCount: isBlueWhiteChampionship ? 1 : round.tournamentBracketCount ?? 1,
        thirdPlaceMatch: isBlueWhiteChampionship ? false : round.thirdPlaceMatch ?? (round.tournamentBracketCount ?? 1) === 1,
        tournamentSeeding: round.tournamentSeeding,
        tournamentStartSize: round.option !== "FINAL" ? round.tournamentStartSize : void 0,
        tournamentSelectedIds: round.tournamentSelectedIds,
        tournamentMode: round.tournamentMode,
        finalAdvancementMode: round.finalAdvancementMode,
        advanceCount: round.advanceCount,
        sourceRoundId: round.sourceRoundId,
        crossClubGrouping: round.crossClubGrouping,
        crossClubOnlyMatches: round.crossClubOnlyMatches,
        halfSplitOnlyMatches: round.halfSplitOnlyMatches,
        competitionMode: round.competitionMode,
        blueWhiteRankingMode: round.blueWhiteRankingMode,
        blueWhiteTournamentPlacement: isBlueWhiteChampionship ? "mixed" : round.blueWhiteTournamentPlacement,
        unitClubMode: round.unitClubMode
      });
    }
    if (round.program === "DOUBLES") {
      let matchCount = 0;
      if (round.format === "LEAGUE") {
        matchCount = calculateRoundRobinMatchCount(
          Math.floor(playerCount / 2)
        );
      }
      if (round.format === "GROUP") {
        matchCount = doublesMatchCount;
      }
      if (round.format === "TOURNAMENT") {
        matchCount = calculateMultipleTournamentMatchCount(Math.floor(playerCount / 2), effectiveTournamentBracketCount, effectiveThirdPlaceMatch, round.option !== "FINAL" ? round.tournamentStartSize : void 0);
      }
      const duration = calculateDuration(
        matchCount,
        courtCount,
        getMatchRuleLabel(round.matchRule)
      );
      blocks.push({
        title: `${blocks.length + 1}\uB77C\uC6B4\uB4DC ${getOptionLabel(round.option, roundIndex)} \uBCF5\uC2DD`,
        roundOption: round.option,
        type: "DOUBLES",
        matchRule: getMatchRuleLabel(round.matchRule),
        nextMatchRule: round.nextMatchRule ? getMatchRuleLabel(round.nextMatchRule) : void 0,
        ruleSwitchSize: round.ruleSwitchSize,
        lateMatchRule: round.lateMatchRule ? getMatchRuleLabel(round.lateMatchRule) : void 0,
        lowerMatchRule: round.lowerMatchRule ? getMatchRuleLabel(round.lowerMatchRule) : void 0,
        lowerRuleSwitchSize: round.lowerRuleSwitchSize,
        lowerLateMatchRule: round.lowerLateMatchRule ? getMatchRuleLabel(round.lowerLateMatchRule) : void 0,
        format: round.format,
        expectedMinutes: duration,
        matchCount,
        groupSizes: roundGroupSizes,
        groupShuffleSeed: round.groupShuffleSeed,
        teamShuffleSeed: round.teamShuffleSeed,
        groupAssignments: round.groupAssignments,
        teamAssignments: round.teamAssignments,
        doublesAssignments: round.doublesAssignments,
        tournamentBracketCount: isBlueWhiteChampionship ? 1 : round.tournamentBracketCount ?? 1,
        thirdPlaceMatch: isBlueWhiteChampionship ? false : round.thirdPlaceMatch ?? (round.tournamentBracketCount ?? 1) === 1,
        tournamentSeeding: round.tournamentSeeding,
        tournamentStartSize: round.option !== "FINAL" ? round.tournamentStartSize : void 0,
        tournamentSelectedIds: round.tournamentSelectedIds,
        tournamentMode: round.tournamentMode,
        finalAdvancementMode: round.finalAdvancementMode,
        advanceCount: round.advanceCount,
        sourceRoundId: round.sourceRoundId,
        crossClubGrouping: round.crossClubGrouping,
        crossClubOnlyMatches: round.crossClubOnlyMatches,
        halfSplitOnlyMatches: round.halfSplitOnlyMatches,
        competitionMode: round.competitionMode,
        blueWhiteRankingMode: round.blueWhiteRankingMode,
        blueWhiteTournamentPlacement: isBlueWhiteChampionship ? "mixed" : round.blueWhiteTournamentPlacement,
        unitClubMode: round.unitClubMode
      });
    }
    if (round.program === "TEAM") {
      const teamCount = calculateTeamCount(
        playerCount,
        round.teamPlayerCount
      );
      const legacyTeamInfo = getTeamMatchInfo(round.teamMatchType);
      const teamInfo = {
        singles: round.teamSinglesCount ?? legacyTeamInfo.singles,
        doubles: round.teamDoublesCount ?? legacyTeamInfo.doubles,
        description: `\uB2E8\uC2DD ${round.teamSinglesCount ?? legacyTeamInfo.singles}\uACBD\uAE30, \uBCF5\uC2DD ${round.teamDoublesCount ?? legacyTeamInfo.doubles}\uACBD\uAE30`
      };
      const teamGroupSizes = round.teamGroupSizes ?? splitIntoTwoGroups(teamCount);
      let matchCount = 0;
      if (round.format === "LEAGUE") {
        matchCount = calculateTeamLeagueMatchCount(
          teamCount
        );
      }
      if (round.format === "GROUP") {
        matchCount = calculateTeamGroupMatchCount(teamGroupSizes);
      }
      if (round.format === "TOURNAMENT") {
        matchCount = calculateMultipleTournamentMatchCount(teamCount, effectiveTournamentBracketCount, effectiveThirdPlaceMatch, round.option !== "FINAL" ? round.tournamentStartSize : void 0);
      }
      const duration = calculateDuration(
        matchCount * (teamInfo.singles + teamInfo.doubles),
        courtCount,
        getMatchRuleLabel(round.matchRule)
      );
      blocks.push({
        title: `${blocks.length + 1}\uB77C\uC6B4\uB4DC ${getOptionLabel(round.option, roundIndex)} \uB2E8\uCCB4\uC804`,
        roundOption: round.option,
        type: "TEAM",
        matchRule: getMatchRuleLabel(round.matchRule),
        nextMatchRule: round.nextMatchRule ? getMatchRuleLabel(round.nextMatchRule) : void 0,
        ruleSwitchSize: round.ruleSwitchSize,
        lateMatchRule: round.lateMatchRule ? getMatchRuleLabel(round.lateMatchRule) : void 0,
        lowerMatchRule: round.lowerMatchRule ? getMatchRuleLabel(round.lowerMatchRule) : void 0,
        lowerRuleSwitchSize: round.lowerRuleSwitchSize,
        lowerLateMatchRule: round.lowerLateMatchRule ? getMatchRuleLabel(round.lowerLateMatchRule) : void 0,
        format: round.format,
        expectedMinutes: duration,
        matchCount: matchCount * (teamInfo.singles + teamInfo.doubles),
        description: teamInfo.description,
        groupSizes: roundGroupSizes,
        teamGroupSizes,
        teamPlayerCount: round.teamPlayerCount,
        groupShuffleSeed: round.groupShuffleSeed,
        teamShuffleSeed: round.teamShuffleSeed,
        groupAssignments: round.groupAssignments,
        teamAssignments: round.teamAssignments,
        tournamentBracketCount: isBlueWhiteChampionship ? 1 : round.tournamentBracketCount ?? 1,
        thirdPlaceMatch: isBlueWhiteChampionship ? false : round.thirdPlaceMatch ?? (round.tournamentBracketCount ?? 1) === 1,
        tournamentSeeding: round.tournamentSeeding,
        tournamentStartSize: round.option !== "FINAL" ? round.tournamentStartSize : void 0,
        tournamentSelectedIds: round.tournamentSelectedIds,
        tournamentMode: round.tournamentMode,
        finalAdvancementMode: round.finalAdvancementMode,
        advanceCount: round.advanceCount,
        sourceRoundId: round.sourceRoundId,
        crossClubGrouping: round.crossClubGrouping,
        crossClubOnlyMatches: round.crossClubOnlyMatches,
        halfSplitOnlyMatches: round.halfSplitOnlyMatches,
        competitionMode: round.competitionMode,
        blueWhiteRankingMode: round.blueWhiteRankingMode,
        blueWhiteTournamentPlacement: isBlueWhiteChampionship ? "mixed" : round.blueWhiteTournamentPlacement,
        unitClubMode: round.unitClubMode,
        teamSinglesCount: teamInfo.singles,
        teamDoublesCount: teamInfo.doubles,
        inheritPreviousTeamFormation: round.inheritPreviousTeamFormation
      });
    }
  }
  return blocks;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  applyProgramTournamentAdvancement,
  generateProgramBlocks,
  generateProgramRoundMatches
});
