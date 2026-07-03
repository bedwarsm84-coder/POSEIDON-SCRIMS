const { Schema, model } = require('mongoose');

const MatchSchema = new Schema({
  clan1Id:   { type: Schema.Types.ObjectId, ref: 'Clan' },
  clan2Id:   { type: Schema.Types.ObjectId, ref: 'Clan' },
  clan1Name: String,
  clan2Name: String,
  winnerId:  { type: Schema.Types.ObjectId, ref: 'Clan' },
  winnerName: String,
  score: {
    clan1: { type: Number, default: 0 },
    clan2: { type: Number, default: 0 },
  },
  status: {
    type: String,
    enum: ['pending', 'live', 'completed', 'bye'],
    default: 'pending',
  },
  round: { type: Number, default: 1 },
}, { _id: true });

const TournamentSchema = new Schema({
  name:       { type: String, required: true },
  mode:       { type: String, enum: ['BW-4v4','BW-2v2','SW-4v4','SW-2v2'], required: true },
  status:     { type: String, enum: ['registration', 'active', 'completed', 'cancelled'], default: 'registration' },
  maxClans:   { type: Number, default: 8 },   // 4, 8, or 16
  season:     { type: Number, default: 1 },
  createdBy:  String,   // Discord user ID

  // Registered clans
  clanIds:    [{ type: Schema.Types.ObjectId, ref: 'Clan' }],
  clanNames:  [String],

  // Bracket
  rounds:     { type: Number, default: 0 },
  currentRound: { type: Number, default: 1 },
  matches:    [MatchSchema],

  // Winner
  winnerId:   { type: Schema.Types.ObjectId, ref: 'Clan' },
  winnerName: String,

  // Discord message for live bracket embed
  embedMessageId: String,
  embedChannelId: String,
}, { timestamps: true });

module.exports = model('Tournament', TournamentSchema);
