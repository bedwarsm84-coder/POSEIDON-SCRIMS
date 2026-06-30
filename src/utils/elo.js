// ── ELO Rating System ────────────────────────────────────────────
// Standard ELO formula with a dynamic K-factor:
//  - New clans (<10 scrims) move fast so they find their real rank quickly
//  - Established clans move slower so top-of-leaderboard ELO stays stable
//  - A small bonus/penalty is added for dominant wins (big score gap)
//  - Win/loss streaks add a small extra modifier to reward consistency

const BASE_ELO = 1000;

function kFactor(clan) {
  const scrims = clan.stats.scrims;
  if (scrims < 10) return 40;   // placement-style, ranks settle fast
  if (scrims < 30) return 28;
  return 20;                    // veteran clans, stable ELO
}

// Expected score for clan A against clan B (standard logistic ELO curve)
function expectedScore(eloA, eloB) {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

/**
 * Calculate new ELO ratings after a scrim.
 * @param {object} winner - winner clan doc (needs stats.elo, stats.scrims, stats.streak)
 * @param {object} loser  - loser clan doc
 * @param {object} scoreDiffInfo - { winnerScore, loserScore } for dominance bonus
 * @returns {{ winnerNewElo, loserNewElo, winnerDelta, loserDelta }}
 */
function calculateElo(winner, loser, { winnerScore = 0, loserScore = 0 } = {}) {
  const winnerElo = winner.stats.elo ?? BASE_ELO;
  const loserElo  = loser.stats.elo ?? BASE_ELO;

  const expectedWinner = expectedScore(winnerElo, loserElo);
  const expectedLoser  = 1 - expectedWinner;

  const kWinner = kFactor(winner);
  const kLoser  = kFactor(loser);

  // Base ELO delta (actual result = 1 for winner, 0 for loser)
  let winnerDelta = kWinner * (1 - expectedWinner);
  let loserDelta  = kLoser  * (0 - expectedLoser);

  // Dominance bonus/penalty: bigger score gap = slightly bigger swing (capped)
  const scoreDiff = Math.max(0, winnerScore - loserScore);
  const dominanceMultiplier = 1 + Math.min(scoreDiff * 0.04, 0.5); // up to +50%
  winnerDelta *= dominanceMultiplier;
  loserDelta  *= dominanceMultiplier;

  // Streak modifier: reward consistency, soften a first loss after a long streak
  const winnerStreak = winner.stats.streak ?? 0;
  const loserStreak  = loser.stats.streak ?? 0;
  if (winnerStreak >= 3) winnerDelta *= 1.1;             // hot streak bonus
  if (loserStreak <= -3) loserDelta *= 0.85;             // mercy on long losing streaks

  winnerDelta = Math.round(winnerDelta);
  loserDelta  = Math.round(loserDelta);

  // Always at least +/-5 so a win/loss is never worthless against huge mismatches
  if (winnerDelta < 5) winnerDelta = 5;
  if (loserDelta > -5) loserDelta = -5;

  const winnerNewElo = Math.max(0, winnerElo + winnerDelta);
  const loserNewElo  = Math.max(0, loserElo + loserDelta);

  return { winnerNewElo, loserNewElo, winnerDelta, loserDelta };
}

module.exports = { calculateElo, expectedScore, kFactor, BASE_ELO };
