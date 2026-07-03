require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const mongoose = require('mongoose');
const fs       = require('fs');
const path     = require('path');

// ── Validate env ─────────────────────────────────────────────────
const required = ['DISCORD_TOKEN','CLIENT_ID','GUILD_ID','MONGODB_URI'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`❌ Missing required env var: ${key}`);
    process.exit(1);
  }
}

// ── Discord client ────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
  ],
});

client.commands = new Collection();

// ── Load commands ─────────────────────────────────────────────────
const cmdDir = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(cmdDir).filter(f => f.endsWith('.js'))) {
  const mod = require(path.join(cmdDir, file));

  // Some files export multiple commands (e.g. leaderboard.js)
  if (mod.data) {
    client.commands.set(mod.data.name, mod);
  } else {
    // Multi-export file
    for (const [, cmd] of Object.entries(mod)) {
      if (cmd?.data) client.commands.set(cmd.data.name, cmd);
    }
  }
}

console.log(`📋 Loaded commands: ${[...client.commands.keys()].join(', ')}`);

// ── Load events ───────────────────────────────────────────────────
const evtDir = path.join(__dirname, 'events');
for (const file of fs.readdirSync(evtDir).filter(f => f.endsWith('.js'))) {
  const event = require(path.join(evtDir, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

// ── MongoDB ───────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected');

    // Start the API server once MongoDB is ready
    const { createApiServer } = require('./api/server');
    const app  = createApiServer();
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`🌐 API server listening on port ${PORT}`));

    // Daily leaderboard post at 20:00 UTC
    scheduleDailyLeaderboard(client);
  })
  .catch(err => { console.error('❌ MongoDB error:', err); process.exit(1); });

// ── Daily Leaderboard Cron ────────────────────────────────────────
function scheduleDailyLeaderboard(client) {
  const Clan = require('./models/Clan');
  const { leaderboardEmbed } = require('./utils/embeds');

  function msUntilNext20UTC() {
    const now  = new Date();
    const next = new Date();
    next.setUTCHours(20, 0, 0, 0);
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    return next - now;
  }

  async function postLeaderboard() {
    const channelId = process.env.LEADERBOARD_CHANNEL;
    if (!channelId) return;

    const channel = client.channels.cache.get(channelId);
    if (!channel) return;

    const clans = await Clan.find({ season: 1 }).sort({ 'stats.elo': -1 }).limit(25);
    const embed = leaderboardEmbed(clans, 1);

    // Edit last bot leaderboard message if it exists, otherwise post new
    const msgs = await channel.messages.fetch({ limit: 10 });
    const existing = msgs.find(m => m.author.id === client.user.id && m.embeds.length > 0);
    if (existing) {
      await existing.edit({ embeds: [embed] }).catch(() => {});
    } else {
      await channel.send({ embeds: [embed] }).catch(() => {});
    }

    console.log('📋 Daily leaderboard posted.');

    // Schedule next day
    setTimeout(postLeaderboard, msUntilNext20UTC());
  }

  // First run
  setTimeout(postLeaderboard, msUntilNext20UTC());
  console.log(`📅 Daily leaderboard scheduled (next run in ${Math.round(msUntilNext20UTC() / 1000 / 60)} min)`);
}

// ── Login ─────────────────────────────────────────────────────────
client.login(process.env.DISCORD_TOKEN);
