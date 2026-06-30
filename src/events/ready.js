const { ActivityType } = require('discord.js');

module.exports = {
  name: 'ready',
  once: true,

  execute(client) {
    console.log(`\n🔱 POSEIDON SCRIMS Bot is online!`);
    console.log(`   Logged in as: ${client.user.tag}`);
    console.log(`   Serving ${client.guilds.cache.size} guild(s)\n`);

    // Rotating status messages
    const statuses = [
      { name: 'POSEIDON SCRIMS',       type: ActivityType.Watching },
      { name: '/scrim queue',           type: ActivityType.Listening },
      { name: 'Bedwars & Skywars',      type: ActivityType.Playing },
      { name: 'the leaderboard',        type: ActivityType.Watching },
    ];

    let i = 0;
    client.user.setPresence({ activities: [statuses[0]], status: 'online' });

    setInterval(() => {
      i = (i + 1) % statuses.length;
      client.user.setPresence({ activities: [statuses[i]], status: 'online' });
    }, 15_000);
  },
};
