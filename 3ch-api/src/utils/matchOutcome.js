function requiredWinScore(rule) {
  const normalized = String(rule ?? '').trim();
  if (normalized === 'BEST_OF_5' || normalized === '5전 3선승제') return 3;
  if (normalized === 'BEST_OF_3' || normalized === '3전 2선승제') return 2;
  return null;
}

function winnerSide(scoreAValue, scoreBValue, rule) {
  const scoreA = Number(scoreAValue);
  const scoreB = Number(scoreBValue);
  if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB)) return null;
  const winScore = requiredWinScore(rule);
  if (winScore !== null) {
    const aWon = scoreA >= winScore;
    const bWon = scoreB >= winScore;
    return aWon === bWon ? null : aWon ? 'a' : 'b';
  }
  if (scoreA === scoreB) return null;
  return scoreA > scoreB ? 'a' : 'b';
}

module.exports = { requiredWinScore, winnerSide };
