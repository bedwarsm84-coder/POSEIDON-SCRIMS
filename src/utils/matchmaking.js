const Queue  = require('../models/Queue');
const Scrim  = require('../models/Scrim');
const { scrimMatchedEmbed } = require('./embeds');

const MAPS = {
  'BW-4v4': ['Breeze', 'Ascent', 'Icebox', 'Pearl', 'Lotus'],
  'BW-2v2': ['Breeze', 'Ascent', 'Icebox'],
  'SW-4v4': ['Pearl', 'Lotus', 'Fracture', 'Haven'],
  'SW-2v2': ['Pearl', 'Lotus', 'Fracture'],
};

function pickMap(mode, pref1, pref2) {
  const pool = MAPS[mode] || MAPS['BW-4v4'];
  if (pref1 !== 'Any' && pool.includes(pref1)) return pref1;
  if (pref2 !== 'Any' && pool.includes(pref2)) return pref2;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Tries to match the newly queued clan against any waiting clan in the same mode.
 * Returns the created Scrim document (or null if no match found yet).
 */
async function tryMatch(newEntry, Clan) {
  // Find oldest waiting entry with same mode, different clan
  const opponent = await Queue.findOne({
    mode:   newEntry.mode,
    clanId: { $ne: newEntry.clanId },
    _id:    { $ne: newEntry._id },
  }).sort({ queuedAt: 1 });

  if (!opponent) return null;

  // Remove both from queue atomically
  await Queue.deleteMany({ _id: { $in: [newEntry._id, opponent._id] } });

  const [clan1, clan2] = await Promise.all([
    Clan.findById(newEntry.clanId),
    Clan.findById(opponent.clanId),
  ]);

  const map = pickMap(newEntry.mode, newEntry.mapPref, opponent.mapPref);

  const scrim = await Scrim.create({
    clan1Id:   clan1._id,
    clan2Id:   clan2._id,
    clan1Name: clan1.name,
    clan2Name: clan2.name,
    mode:      newEntry.mode,
    map,
    status:    'scheduled',
    season:    1,
  });

  return { scrim, clan1, clan2 };
}

module.exports = { tryMatch, MAPS };
