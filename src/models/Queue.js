const { Schema, model } = require('mongoose');

const QueueSchema = new Schema({
  clanId:   { type: Schema.Types.ObjectId, ref: 'Clan', required: true },
  clanName: String,
  leaderId: String,        // Discord user ID who queued
  mode:     { type: String, enum: ['BW-4v4','BW-2v2','SW-4v4','SW-2v2'], required: true },
  mapPref:  { type: String, default: 'Any' },
  queuedAt: { type: Date, default: Date.now },
  // Automatically expire queue entries after 2 hours
  expiresAt: { type: Date, default: () => new Date(Date.now() + 2 * 60 * 60 * 1000), index: { expires: 0 } },
});

module.exports = model('Queue', QueueSchema);
