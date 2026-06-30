const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Clan  = require('../models/Clan');
const Scrim = require('../models/Scrim');
const { leaderboardEmbed, errorEmbed, successEmbed } = require('../utils/embeds');
const { calculateElo, BASE_ELO } = require('../utils/elo');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Staff-only commands')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    // /admin forceres
    .addSubcommand(sub => sub
      .setName('forceres')
      .setDescription('Force a scrim result (staff only)')
      .addStringOption(o => o.setName('scrim_id').setDescription('Scrim ID').setRequired(true))
      .addStringOption(o => o.setName('winner_tag').setDescription('Winning clan tag').setRequired(true))
      .addIntegerOption(o => o.setName('score1').setDescription('Clan 1 score').setRequired(true))
      .addIntegerOption(o => o.setName('score2').setDescription('Clan 2 score').setRequired(true))
    )

    // /admin updatelb
    .addSubcommand(sub => sub
      .setName('updatelb')
      .setDescription('Post/update leaderboard in the leaderboard channel')
    )

    // /admin resetseason
    .addSubcommand(sub => sub
      .setName('resetseason')
      .setDescription('⚠️ Reset all clan season stats and start a new season')
      .addIntegerOption(o => o.setName('new_season').setDescription('New season number').setRequired(true))
    )

    // /admin clandelete
    .addSubcommand(sub => sub
      .setName('clandelete')
      .setDescription('Delete a clan by tag')
      .addStringOption(o => o.setName('tag').setDescription('Clan tag').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    // ── FORCE RESULT ──────────────────────────────────────────────
    if (sub === 'forceres') {
      const scrimId   = interaction.options.getString('scrim_id');
      const winnerTag = interaction.options.getString('winner_tag').toUpperCase();
      const s1        = interaction.options.getInteger('score1');
      const s2        = interaction.options.getInteger('score2');

      const scrim = await Scrim.findById(scrimId).catch(() => null);
      if (!scrim) return interaction.reply({ embeds: [errorEmbed('Scrim not found.')], ephemeral: true });

      const [clan1, clan2, winner] = await Promise.all([
        Clan.findById(scrim.clan1Id),
        Clan.findById(scrim.clan2Id),
        Clan.findOne({ tag: winnerTag }),
      ]);
      if (!winner) return interaction.reply({ embeds: [errorEmbed(`Clan [${winnerTag}] not found.`)], ephemeral: true });

      const loser = winner._id.equals(clan1._id) ? clan2 : clan1;

      // Update scrim
      scrim.score.clan1 = s1;
      scrim.score.clan2 = s2;
      scrim.winnerId    = winner._id;
      scrim.winnerName  = winner.name;
      scrim.status      = 'completed';
      scrim.endedAt     = new Date();
      await scrim.save();

      // Update clan stats (ELO)
      const { winnerNewElo, loserNewElo, winnerDelta, loserDelta } =
        calculateElo(winner, loser, { winnerScore: Math.max(s1, s2), loserScore: Math.min(s1, s2) });

      const winnerNewStreak = (winner.stats.streak ?? 0) >= 0 ? (winner.stats.streak ?? 0) + 1 : 1;
      const loserNewStreak  = (loser.stats.streak ?? 0) <= 0 ? (loser.stats.streak ?? 0) - 1 : -1;

      await Clan.findByIdAndUpdate(winner._id, {
        $inc: { 'stats.wins': 1, 'stats.scrims': 1, 'allTime.wins': 1, 'allTime.scrims': 1 },
        $set: {
          'stats.elo': winnerNewElo,
          'stats.streak': winnerNewStreak,
          'stats.peakElo': Math.max(winner.stats.peakElo ?? 1000, winnerNewElo),
        },
      });
      await Clan.findByIdAndUpdate(loser._id, {
        $inc: { 'stats.losses': 1, 'stats.scrims': 1, 'allTime.losses': 1, 'allTime.scrims': 1 },
        $set: { 'stats.elo': loserNewElo, 'stats.streak': loserNewStreak },
      });

      await interaction.reply({ embeds: [successEmbed(`✅ Forced result: **${winner.name}** wins ${s1}–${s2} over **${loser.name}**. ELO: ${winner.stats.elo} → **${winnerNewElo}** (+${winnerDelta})`)] });
    }

    // ── UPDATE LEADERBOARD ────────────────────────────────────────
    else if (sub === 'updatelb') {
      const ch = interaction.guild.channels.cache.get(process.env.LEADERBOARD_CHANNEL);
      if (!ch) return interaction.reply({ embeds: [errorEmbed('Leaderboard channel not configured in .env')], ephemeral: true });

      const clans = await Clan.find().sort({ 'stats.elo': -1 }).limit(25);
      const embed = leaderboardEmbed(clans, 1);

      // Try to find last leaderboard message and edit it
      const msgs = await ch.messages.fetch({ limit: 5 });
      const existing = msgs.find(m => m.author.id === interaction.client.user.id && m.embeds.length > 0);

      if (existing) {
        await existing.edit({ embeds: [embed] });
        await interaction.reply({ embeds: [successEmbed('Leaderboard updated!')], ephemeral: true });
      } else {
        await ch.send({ embeds: [embed] });
        await interaction.reply({ embeds: [successEmbed('Leaderboard posted!')], ephemeral: true });
      }
    }

    // ── RESET SEASON ──────────────────────────────────────────────
    else if (sub === 'resetseason') {
      const newSeason = interaction.options.getInteger('new_season');
      await Clan.updateMany({}, {
        $set: {
          season: newSeason,
          'stats.wins':    0,
          'stats.losses':  0,
          'stats.elo':     BASE_ELO,
          'stats.peakElo': BASE_ELO,
          'stats.streak':  0,
          'stats.kills':   0,
          'stats.deaths':  0,
          'stats.scrims':  0,
        },
      });
      await interaction.reply({ embeds: [successEmbed(`🔄 Season reset! Season **${newSeason}** has begun.`)] });
    }

    // ── DELETE CLAN ───────────────────────────────────────────────
    else if (sub === 'clandelete') {
      const tag  = interaction.options.getString('tag').toUpperCase();
      const clan = await Clan.findOneAndDelete({ tag });
      if (!clan) return interaction.reply({ embeds: [errorEmbed(`Clan [${tag}] not found.`)], ephemeral: true });
      await interaction.reply({ embeds: [successEmbed(`Clan **[${clan.tag}] ${clan.name}** has been deleted.`)] });
    }
  },
};
