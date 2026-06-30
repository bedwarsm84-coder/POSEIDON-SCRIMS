const express = require('express');
const cors    = require('cors');
const Clan    = require('../models/Clan');
const Scrim   = require('../models/Scrim');

function createApiServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // ── GET /api/leaderboard ─────────────────────────────────────────
  // Returns clans sorted by ELO, shaped for the dashboard table
  app.get('/api/leaderboard', async (req, res) => {
    try {
      const season = parseInt(req.query.season) || 1;
      const clans = await Clan.find({ season }).sort({ 'stats.elo': -1 }).limit(25);

      const data = clans.map((c, i) => {
        const total = c.stats.wins + c.stats.losses;
        const wr    = total === 0 ? 0 : Math.round((c.stats.wins / total) * 100);
        const kd    = c.stats.deaths === 0 ? c.stats.kills : +(c.stats.kills / c.stats.deaths).toFixed(2);
        return {
          rank: i + 1,
          name: c.name,
          tag: c.tag,
          members: c.memberIds.length,
          wins: c.stats.wins,
          losses: c.stats.losses,
          elo: c.stats.elo,
          rankTier: c.rank,
          kd,
          winRate: wr,
          streak: c.stats.streak,
        };
      });

      res.json({ season, clans: data });
    } catch (err) {
      console.error('[API] /leaderboard error:', err);
      res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
  });

  // ── GET /api/scrims/live ─────────────────────────────────────────
  app.get('/api/scrims/live', async (req, res) => {
    try {
      const scrims = await Scrim.find({
        status: { $in: ['live', 'scheduled', 'pending_result', 'completed'] },
      })
        .sort({ updatedAt: -1 })
        .limit(10);

      const data = scrims.map(s => ({
        id: s._id,
        clan1: s.clan1Name,
        clan2: s.clan2Name,
        mode: s.mode,
        map: s.map,
        status: s.status,
        score: s.score,
        winner: s.winnerName || null,
      }));

      res.json({ scrims: data });
    } catch (err) {
      console.error('[API] /scrims/live error:', err);
      res.status(500).json({ error: 'Failed to fetch live scrims' });
    }
  });

  // ── GET /api/stats ───────────────────────────────────────────────
  app.get('/api/stats', async (req, res) => {
    try {
      const [clanCount, scrimCount, liveCount] = await Promise.all([
        Clan.countDocuments(),
        Scrim.countDocuments({ status: 'completed' }),
        Scrim.countDocuments({ status: 'live' }),
      ]);
      res.json({ clans: clanCount, completedScrims: scrimCount, liveScrims: liveCount });
    } catch (err) {
      console.error('[API] /stats error:', err);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  // ── GET /api/clan/:tag ───────────────────────────────────────────
  app.get('/api/clan/:tag', async (req, res) => {
    try {
      const tag  = req.params.tag.toUpperCase();
      const clan = await Clan.findOne({ tag });
      if (!clan) return res.status(404).json({ error: 'Clan not found' });

      const total = clan.stats.wins + clan.stats.losses;
      res.json({
        name: clan.name,
        tag: clan.tag,
        members: clan.memberIds.length,
        leaderId: clan.leaderId,
        elo: clan.stats.elo,
        peakElo: clan.stats.peakElo,
        rankTier: clan.rank,
        wins: clan.stats.wins,
        losses: clan.stats.losses,
        winRate: total === 0 ? 0 : Math.round((clan.stats.wins / total) * 100),
        streak: clan.stats.streak,
        season: clan.season,
      });
    } catch (err) {
      console.error('[API] /clan/:tag error:', err);
      res.status(500).json({ error: 'Failed to fetch clan' });
    }
  });

  app.get('/health', (req, res) => res.json({ ok: true }));

  return app;
}

module.exports = { createApiServer };
