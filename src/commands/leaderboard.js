const { SlashCommandBuilder } = require('discord.js');
const Clan  = require('../models/Clan');
const Scrim = require('../models/Scrim');
const { leaderboardEmbed, clanInfoEmbed, errorEmbed } = require('../utils/embeds');

// ─────────────────────────────────────────────
// /leaderboard
// ─────────────────────────────────────────────
const leaderboard = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show the Season leaderboard')
    .addIntegerOption(o => o
      .setName('season').setDescription('Season number (default: current)').setMinValue(1)
    ),

  async execute(interaction) {
    const season = interaction.options.getInteger('season') || 1;
    const clans  = await Clan.find({ season }).sort({ 'stats.elo': -1 }).limit(25);
    await interaction.reply({ embeds: [leaderboardEmbed(clans, season)] });
  },
};

// ─────────────────────────────────────────────
// /stats
// ─────────────────────────────────────────────
const stats = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('View stats for yourself or a clan')
    .addSubcommand(sub => sub
      .setName('clan')
      .setDescription('Clan stats')
      .addStringOption(o => o.setName('tag').setDescription('Clan tag').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('player')
      .setDescription('Your personal clan overview')
    )
    .addSubcommand(sub => sub
      .setName('history')
      .setDescription('Last 5 scrim results for a clan')
      .addStringOption(o => o.setName('tag').setDescription('Clan tag').setRequired(true))
    ),

  async execute(interaction) {
    const sub    = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    // ── CLAN STATS ──
    if (sub === 'clan') {
      const tag  = interaction.options.getString('tag').toUpperCase();
      const clan = await Clan.findOne({ tag });
      if (!clan) return interaction.reply({ embeds: [errorEmbed(`Clan \`[${tag}]\` not found.`)], ephemeral: true });
      return interaction.reply({ embeds: [clanInfoEmbed(clan)] });
    }

    // ── PLAYER STATS ──
    if (sub === 'player') {
      const clan = await Clan.findOne({ memberIds: userId });
      if (!clan) return interaction.reply({ embeds: [errorEmbed('You are not in a clan. Register one with `/clan register`.')], ephemeral: true });
      return interaction.reply({ embeds: [clanInfoEmbed(clan)], ephemeral: true });
    }

    // ── HISTORY ──
    if (sub === 'history') {
      const tag  = interaction.options.getString('tag').toUpperCase();
      const clan = await Clan.findOne({ tag });
      if (!clan) return interaction.reply({ embeds: [errorEmbed(`Clan \`[${tag}]\` not found.`)], ephemeral: true });

      const scrims = await Scrim.find({
        status: 'completed',
        $or: [{ clan1Id: clan._id }, { clan2Id: clan._id }],
      }).sort({ endedAt: -1 }).limit(5);

      if (!scrims.length) return interaction.reply({ embeds: [errorEmbed(`No completed scrims found for **[${tag}]**.`)], ephemeral: true });

      const lines = scrims.map(s => {
        const isClan1  = s.clan1Id.equals(clan._id);
        const opp      = isClan1 ? s.clan2Name : s.clan1Name;
        const myScore  = isClan1 ? s.score.clan1 : s.score.clan2;
        const oppScore = isClan1 ? s.score.clan2 : s.score.clan1;
        const won      = s.winnerId?.equals(clan._id);
        const icon     = won ? '✅' : '❌';
        return `${icon} vs **${opp}** — ${myScore}–${oppScore} | ${s.mode} · ${s.map || '—'}`;
      });

      const { EmbedBuilder } = require('discord.js');
      const embed = new EmbedBuilder()
        .setColor(0x00DDFF)
        .setTitle(`📋 [${clan.tag}] ${clan.name} — Recent Results`)
        .setDescription(lines.join('\n'))
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }
  },
};

module.exports = { leaderboard, stats };
