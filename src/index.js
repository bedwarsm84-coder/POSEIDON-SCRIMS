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

  if (mod.data) {
    client.commands.set(mod.data.name, mod);
  } else {
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
  })
  .catch(err => { console.error('❌ MongoDB error:', err); process.exit(1); });

// ── Login ─────────────────────────────────────────────────────────
client.login(process.env.DISCORD_TOKEN);
