const { Schema, model } = require('mongoose');

const ScrimSchema = new Schema({
  // Teams
  clan1Id:   { type: Schema.Types.ObjectId, ref: 'Clan', required: true },
  clan2Id:   { type: Schema.Types.ObjectId, ref: 'Clan', required: true },
  clan1Name: String,
  clan2Name: String,

  // Match details
  mode:   { type: String, enum: ['BW-4v4','BW-2v2','SW-4v4','SW-2v2'], required: true },
  map:    { type: String, default: 'TBD' },
  season: { type: Number, default: 1 },

  // Status flow: queued → scheduled → live → pending_result → completed | disputed | cancelled
  status: {
    type: String,
    enum: ['queued','scheduled','live','pending_result','completed','disputed','cancelled'],
    default: 'queued',
  },

  // Scheduling
  scheduledAt: Date,
  startedAt:   Date,
  endedAt:     Date,

  // Result
  winnerId:   { type: Schema.Types.ObjectId, ref: 'Clan' },
  winnerName: String,
  score: {
    clan1: { type: Number, default: 0 },
    clan2: { type: Number, default: 0 },
  },
  kills: {
    clan1: { type: Number, default: 0 },
    clan2: { type: Number, default: 0 },
  },

  // Submission
  submittedBy:    String,   // Discord user ID
  proofUrl:       String,   // Screenshot URL
  confirmedBy:    String,   // Opponent's Discord ID who confirmed
  disputeReason:  String,

  // Discord message ID of the live scrim embed (for editing)
  embedMessageId: String,
  embedChannelId: String,
}, { timestamps: true });

module.exports = model('Scrim', ScrimSchema);
