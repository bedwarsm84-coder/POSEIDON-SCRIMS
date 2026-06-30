require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs   = require('fs');
const path = require('path');

const commands = [];

const cmdDir = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(cmdDir).filter(f => f.endsWith('.js'))) {
  const mod = require(path.join(cmdDir, file));
  if (mod.data) {
    commands.push(mod.data.toJSON());
  } else {
    for (const [, cmd] of Object.entries(mod)) {
      if (cmd?.data) commands.push(cmd.data.toJSON());
    }
  }
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`🔄 Deploying ${commands.length} slash command(s)...`);
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands },
    );
    console.log('✅ Commands deployed successfully!');
    console.log('Commands:', commands.map(c => `/${c.name}`).join(', '));
  } catch (err) {
    console.error('❌ Deploy error:', err);
  }
})();
