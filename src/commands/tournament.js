const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Tournament = require('../models/Tournament');
const Clan       = require('../models/Clan');
const { errorEmbed, successEmbed, COLORS } = require('../utils/embeds');

const TRIDENT = '🔱';
const DIV     = '▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰';
const MODES   = ['BW-4v4','BW-2v2','SW-4v4','SW-2v2'];

function generateBracket(clanIds, clanNames) {
  const matches = [];
  let round = 1;
  const pairs = [...clanIds];
  while (pairs.length & (pairs.length - 1)) pairs.push(null);

  for (let i = 0; i < pairs.length; i += 2) {
    const c1 = pairs[i];
    const c2 = pairs[i + 1];
    const idx1 = clanIds.indexOf(c1);
    const idx2 = c2 ? clanIds.indexOf(c2) : -1;
    matches.push({
      clan1Id:   c1,
      clan2Id:   c2 || null,
      clan1Name: idx1 >= 0 ? clanNames[idx1] : '—',
      clan2Name: idx2 >= 0 ? clanNames[idx2] : 'BYE',
      status:    c2 ? 'pending' : 'bye',
      winnerId:  c2 ? null : c1,
      winnerName: c2 ? null : (idx1 >= 0 ? clanNames[idx1] : '—'),
      round,
    });
  }
  return matches;
}

function bracketEmbed(t) {
  const rounds = [...new Set(t.matches.map(m => m.round))].sort((a, b) => a - b);

  const lines = rounds.map(r => {
    const rMatches = t.matches.filter(m => m.round === r);
    const header = `\n**— ROUND ${r} —**\n`;
    const rows = rMatches.map(m => {
      const icon = m.status === 'completed' ? '✅' : m.status === 'bye' ? '⏭️' : '⏳';
      const score = m.status === 'completed' ? ` \`${m.score.clan1}–${m.score.clan2}\`` : '';
      return `${icon} **${m.clan1Name}** vs **${m.clan2Name}**${score}${m.winnerName ? ` → 🏆 ${m.winnerName}` : ''}`;
    });
    return header + rows.join('\n');
  }).join('\n');

  return new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle(`${TRIDENT}  TOURNAMENT — ${t.name.toUpperCase()}`)
    .setDescription(
      `\`\`\`ansi\n[2;36m▸ TOURNAMENT BRACKET — ${t.mode}[0m\n\`\`\`` +
      `${DIV}\n` +
      lines +
      `\n\n${DIV}\n` +
      (t.status === 'completed' ? `\n🏆  **WINNER: ${t.winnerName}**` : `\n📋  Round **${t.currentRound}** in progress`)
    )
    .addFields(
      { name: '🎮 Mode',   value: `\`${t.mode}\``,                 inline: true },
      { name: '👥 Clans',  value: `\`${t.clanIds.length}\``,       inline: true },
      { name: '📊 Status', value: `\`${t.status.toUpperCase()}\``, inline: true },
    )
    .setFooter({ text: `${TRIDENT} POSEIDON SCRIMS  •  TOURNAMENT` })
    .setTimestamp();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tournament')
    .setDescription('Tournament management')

    .addSubcommand(sub => sub
      .setName('create')
      .setDescription('Create a new tournament (Staff only)')
      .addStringOption(o => o.setName('name').setDescription('Tournament name').setRequired(true))
      .addStringOption(o => o.setName('mode').setDescription('Game mode').setRequired(true)
        .addChoices(...MODES.map(m => ({ name: m, value: m })))
      )
      .addIntegerOption(o => o.setName('max_clans').setDescription('Max clans (4, 8, or 16)').setRequired(true)
        .addChoices({ name: '4', value: 4 }, { name: '8', value: 8 }, { name: '16', value: 16 })
      )
    )
    .addSubcommand(sub => sub
      .setName('register')
      .setDescription('Register your clan for the active tournament')
    )
    .addSubcommand(sub => sub
      .setName('bracket')
      .setDescription('View the current tournament bracket')
    )
    .addSubcommand(sub => sub
      .setName('result')
      .setDescription('Submit a tournament match result (Staff only)')
      .addStringOption(o => o.setName('tournament_id').setDescription('Tournament ID').setRequired(true))
      .addIntegerOption(o => o.setName('match_index').setDescription('Match number (from bracket)').setRequired(true))
      .addStringOption(o => o.setName('winner_tag').setDescription('Winning clan tag').setRequired(true))
      .addIntegerOption(o => o.setName('score1').setDescription('Clan 1 score').setRequired(true))
      .addIntegerOption(o => o.setName('score2').setDescription('Clan 2 score').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('start')
      .setDescription('Start the tournament and generate bracket (Staff only)')
      .addStringOption(o => o.setName('tournament_id').setDescription('Tournament ID').setRequired(true))
    ),

  async execute(interaction) {
    const sub    = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    const isStaff = () => {
      const staffId = process.env.STAFF_ROLE;
      return !staffId || interaction.member.roles.cache.has(staffId);
    };

    if (sub === 'create') {
      if (!isStaff()) return interaction.reply({ embeds: [errorEmbed('Staff only.')], ephemeral: true });

      const name     = interaction.options.getString('name').trim();
      const mode     = interaction.options.getString('mode');
      const maxClans = interaction.options.getInteger('max_clans');

      const t = await Tournament.create({ name, mode, maxClans, createdBy: userId, season: 1 });

      await interaction.reply({
        embeds: [successEmbed(
          `Tournament **${name}** created!\n` +
          `▸ Mode: \`${mode}\` | Max Clans: \`${maxClans}\`\n` +
          `▸ ID: \`${t._id}\`\n` +
          `▸ Clans can now register with \`/tournament register\``
        )],
      });
    }

    else if (sub === 'register') {
      const clan = await Clan.findOne({ leaderId: userId });
      if (!clan) return interaction.reply({ embeds: [errorEmbed('Only clan leaders can register.')], ephemeral: true });

      const t = await Tournament.findOne({ status: 'registration' }).sort({ createdAt: -1 });
      if (!t) return interaction.reply({ embeds: [errorEmbed('No active tournament registration found.')], ephemeral: true });

      if (t.clanIds.some(id => id.equals(clan._id))) return interaction.reply({
        embeds: [errorEmbed('Your clan is already registered.')], ephemeral: true,
      });

      if (t.clanIds.length >= t.maxClans) return interaction.reply({
        embeds: [errorEmbed(`Tournament is full (${t.maxClans} clans max).`)], ephemeral: true,
      });

      t.clanIds.push(clan._id);
      t.clanNames.push(clan.name);
      await t.save();

      await interaction.reply({
        embeds: [successEmbed(
          `**[${clan.tag}] ${clan.name}** registered for **${t.name}**!\n` +
          `▸ Slots filled: \`${t.clanIds.length} / ${t.maxClans}\``
        )],
      });
    }

    else if (sub === 'bracket') {
      const t = await Tournament.findOne({ status: { $in: ['active', 'completed'] } }).sort({ createdAt: -1 });
      if (!t) return interaction.reply({ embeds: [errorEmbed('No active tournament found.')], ephemeral: true });
      await interaction.reply({ embeds: [bracketEmbed(t)] });
    }

    else if (sub === 'start') {
      if (!isStaff()) return interaction.reply({ embeds: [errorEmbed('Staff only.')], ephemeral: true });

      const tId = interaction.options.getString('tournament_id');
      const t   = await Tournament.findById(tId).catch(() => null);
      if (!t) return interaction.reply({ embeds: [errorEmbed('Tournament not found.')], ephemeral: true });
      if (t.clanIds.length < 2) return interaction.reply({ embeds: [errorEmbed('Need at least 2 clans to start.')], ephemeral: true });

      const shuffled = [...t.clanIds].map((id, i) => ({ id, name: t.clanNames[i] }))
        .sort(() => Math.random() - 0.5);

      t.matches      = generateBracket(shuffled.map(c => c.id), shuffled.map(c => c.name));
      t.rounds       = Math.ceil(Math.log2(t.clanIds.length));
      t.currentRound = 1;
      t.status       = 'active';
      await t.save();

      const embed = bracketEmbed(t);
      const ch = interaction.guild.channels.cache.get(process.env.ANNOUNCEMENTS_CHANNEL);
      if (ch) {
        const msg = await ch.send({ embeds: [embed] });
        t.embedMessageId = msg.id;
        t.embedChannelId = ch.id;
        await t.save();
      }

      await interaction.reply({ embeds: [embed] });
    }

    else if (sub === 'result') {
      if (!isStaff()) return interaction.reply({ embeds: [errorEmbed('Staff only.')], ephemeral: true });

      const tId        = interaction.options.getString('tournament_id');
      const matchIndex = interaction.options.getInteger('match_index') - 1;
      const winnerTag  = interaction.options.getString('winner_tag').toUpperCase();
      const s1         = interaction.options.getInteger('score1');
      const s2         = interaction.options.getInteger('score2');

      const t = await Tournament.findById(tId).catch(() => null);
      if (!t) return interaction.reply({ embeds: [errorEmbed('Tournament not found.')], ephemeral: true });

      const roundMatches = t.matches.filter(m => m.round === t.currentRound);
      const match = roundMatches[matchIndex];
      if (!match) return interaction.reply({ embeds: [errorEmbed(`Match #${matchIndex + 1} not found in round ${t.currentRound}.`)], ephemeral: true });

      const winner = match.clan1Name.toUpperCase() === winnerTag
        ? { id: match.clan1Id, name: match.clan1Name }
        : { id: match.clan2Id, name: match.clan2Name };

      match.score.clan1 = s1;
      match.score.clan2 = s2;
      match.winnerId    = winner.id;
      match.winnerName  = winner.name;
      match.status      = 'completed';

      const allDone = t.matches.filter(m => m.round === t.currentRound).every(m => m.status !== 'pending');

      if (allDone) {
        const winners = t.matches
          .filter(m => m.round === t.currentRound)
          .map(m => ({ id: m.winnerId, name: m.winnerName }));

        if (winners.length === 1) {
          t.status     = 'completed';
          t.winnerId   = winners[0].id;
          t.winnerName = winners[0].name;
        } else {
          t.currentRound++;
          const nextMatches = generateBracket(winners.map(w => w.id), winners.map(w => w.name));
          nextMatches.forEach(m => { m.round = t.currentRound; t.matches.push(m); });
        }
      }

      t.markModified('matches');
      await t.save();

      const embed = bracketEmbed(t);
      if (t.embedMessageId && t.embedChannelId) {
        const ch  = interaction.guild.channels.cache.get(t.embedChannelId);
        const msg = await ch?.messages.fetch(t.embedMessageId).catch(() => null);
        if (msg) await msg.edit({ embeds: [embed] });
      }

      await interaction.reply({ embeds: [embed] });
    }
  },
};
