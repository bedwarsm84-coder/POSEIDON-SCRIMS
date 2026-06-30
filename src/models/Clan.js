const { Schema, model } = require('mongoose');

const ClanSchema = new Schema({
  name: { type: String, required: true, unique: true },
  tag:  { type: String, required: true, unique: true, uppercase: true, maxlength: 6 },
  leaderId:  { type: String, required: true },   // Discord user ID
  memberIds: [{ type: String }],                 // Discord user IDs (max 8)
  createdAt: { type: Date, default: Date.now },

  // Season stats (reset each season)
  stats: {
    wins:   { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    elo:    { type: Number, default: 1000 },   // ELO rating, replaces flat points
    peakElo:{ type: Number, default: 1000 },   // highest ELO reached this season
    kills:  { type: Number, default: 0 },
    deaths: { type: Number, default: 0 },
    scrims: { type: Number, default: 0 },
    streak: { type: Number, default: 0 },      // positive = win streak, negative = loss streak
  },

  // All-time stats (never reset)
  allTime: {
    wins:   { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    scrims: { type: Number, default: 0 },
  },

  season: { type: Number, default: 1 },
}, { timestamps: true });

// Virtual: win rate
ClanSchema.virtual('winRate').get(function () {
  const total = this.stats.wins + this.stats.losses;
  return total === 0 ? 0 : Math.round((this.stats.wins / total) * 100);
});

// Virtual: KD ratio
ClanSchema.virtual('kd').get(function () {
  return this.stats.deaths === 0
    ? this.stats.kills.toFixed(1)
    : (this.stats.kills / this.stats.deaths).toFixed(2);
});

// Virtual: rank tier based on ELO (matches the thresholds used in #leaderboard)
ClanSchema.virtual('rank').get(function () {
  const elo = this.stats.elo;
  if (elo >= 2200) return { name: 'Legend',   emoji: '🔱', color: '#00FFEE' };
  if (elo >= 2000) return { name: 'Champion', emoji: '👑', color: '#FFD60A' };
  if (elo >= 1800) return { name: 'Master',   emoji: '🏆', color: '#FF9500' };
  if (elo >= 1600) return { name: 'Diamond',  emoji: '💎', color: '#00AAFF' };
  if (elo >= 1400) return { name: 'Platinum', emoji: '💠', color: '#00DDFF' };
  if (elo >= 1200) return { name: 'Gold',     emoji: '🥇', color: '#FFD60A' };
  if (elo >= 1000) return { name: 'Silver',   emoji: '🥈', color: '#C0C8D8' };
  return                  { name: 'Bronze',   emoji: '🥉', color: '#CD7F32' };
});

module.exports = model('Clan', ClanSchema);
