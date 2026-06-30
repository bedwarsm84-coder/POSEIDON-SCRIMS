const Scrim = require('../models/Scrim');
const Clan  = require('../models/Clan');
const { EmbedBuilder } = require('discord.js');
const { errorEmbed, successEmbed } = require('../utils/embeds');
const { calculateElo } = require('../utils/elo');

module.exports = {
  name: 'interactionCreate',

  async execute(interaction, client) {
    // ── SLASH COMMANDS ────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction);
      } catch (err) {
        console.error(`[CMD ERROR] /${interaction.commandName}:`, err);
        const msg = { embeds: [errorEmbed('Something went wrong. Please try again.')], ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(msg);
        } else {
          await interaction.reply(msg);
        }
      }
      return;
    }

    // ── BUTTONS ───────────────────────────────────────────────────
    if (!interaction.isButton()) return;
    const { customId, user } = interaction;

    // ── CONFIRM RESULT ──
    if (customId.startsWith('confirm_result_')) {
      const scrimId = customId.replace('confirm_result_', '');
      const scrim   = await Scrim.findById(scrimId).catch(() => null);
      if (!scrim) return interaction.reply({ embeds: [errorEmbed('Scrim not found.')], ephemeral: true });
      if (scrim.status !== 'pending_result') return interaction.reply({ embeds: [errorEmbed('This result has already been processed.')], ephemeral: true });

      const clan1 = await Clan.findById(scrim.clan1Id);
      const clan2 = await Clan.findById(scrim.clan2Id);

      // Must be the opponent (not the submitter)
      if (user.id === scrim.submittedBy) return interaction.reply({ embeds: [errorEmbed("You can't confirm your own result.")], ephemeral: true });
      const isClan1 = user.id === clan1.leaderId;
      const isClan2 = user.id === clan2.leaderId;
      if (!isClan1 && !isClan2) return interaction.reply({ embeds: [errorEmbed('You are not a clan leader in this scrim.')], ephemeral: true });

      // Finalise
      scrim.status      = 'completed';
      scrim.confirmedBy = user.id;
      await scrim.save();

      const winner = scrim.winnerId.equals(clan1._id) ? clan1 : clan2;
      const loser  = winner._id.equals(clan1._id) ? clan2 : clan1;

      const winnerScore = winner._id.equals(clan1._id) ? scrim.score.clan1 : scrim.score.clan2;
      const loserScore  = winner._id.equals(clan1._id) ? scrim.score.clan2 : scrim.score.clan1;

      const { winnerNewElo, loserNewElo, winnerDelta, loserDelta } =
        calculateElo(winner, loser, { winnerScore, loserScore });

      const winnerNewStreak = (winner.stats.streak ?? 0) >= 0 ? (winner.stats.streak ?? 0) + 1 : 1;
      const loserNewStreak  = (loser.stats.streak ?? 0) <= 0 ? (loser.stats.streak ?? 0) - 1 : -1;

      // Update clan stats (ELO + win/loss + streak + peak ELO)
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

      // Post in results channel
      const resultsChannel = interaction.client.guilds.cache
        .first()?.channels.cache.get(process.env.SCRIM_RESULTS_CHANNEL);

      const embed = new EmbedBuilder()
        .setColor(0x00FF88)
        .setTitle(`✅ RESULT CONFIRMED — ${clan1.name} vs ${clan2.name}`)
        .setDescription(`🏆 **${winner.name}** wins!`)
        .addFields(
          { name: 'Score',    value: `${scrim.score.clan1} — ${scrim.score.clan2}`, inline: true },
          { name: 'Mode',     value: scrim.mode,  inline: true },
          { name: 'Map',      value: scrim.map || '—', inline: true },
          { name: `${winner.name} ELO`, value: `${winner.stats.elo} → **${winnerNewElo}** (+${winnerDelta})`, inline: true },
          { name: `${loser.name} ELO`,  value: `${loser.stats.elo} → **${loserNewElo}** (${loserDelta})`, inline: true },
        )
        .setTimestamp();

      if (scrim.proofUrl) embed.setImage(scrim.proofUrl);
      if (resultsChannel) await resultsChannel.send({ embeds: [embed] });

      await interaction.update({
        content: `✅ Result confirmed! **${winner.name}** ELO: **${winnerNewElo}** (+${winnerDelta})`,
        embeds: [embed],
        components: [],
      });
    }

    // ── DISPUTE RESULT ──
    else if (customId.startsWith('dispute_result_')) {
      const scrimId = customId.replace('dispute_result_', '');
      const scrim   = await Scrim.findById(scrimId).catch(() => null);
      if (!scrim) return interaction.reply({ embeds: [errorEmbed('Scrim not found.')], ephemeral: true });
      if (scrim.status !== 'pending_result') return interaction.reply({ embeds: [errorEmbed('This result has already been processed.')], ephemeral: true });

      scrim.status        = 'disputed';
      scrim.disputeReason = `Disputed by ${user.username} (${user.id})`;
      await scrim.save();

      // Alert staff
      const logChannel = interaction.client.guilds.cache
        .first()?.channels.cache.get(process.env.LOG_CHANNEL);

      const clan1 = await Clan.findById(scrim.clan1Id);
      const clan2 = await Clan.findById(scrim.clan2Id);

      const disputeEmbed = new EmbedBuilder()
        .setColor(0xFF2D55)
        .setTitle('⚠️ SCRIM DISPUTED')
        .setDescription(`**${clan1.name}** vs **${clan2.name}** — disputed by <@${user.id}>`)
        .addFields(
          { name: 'Scrim ID', value: scrimId, inline: true },
          { name: 'Score',    value: `${scrim.score.clan1}–${scrim.score.clan2}`, inline: true },
          { name: 'Proof',    value: scrim.proofUrl || 'None', inline: false },
        )
        .setTimestamp();

      if (logChannel) {
        const staffRole = interaction.client.guilds.cache.first()
          ?.roles.cache.get(process.env.STAFF_ROLE);
        await logChannel.send({
          content: staffRole ? `${staffRole} — dispute needs review!` : '@here — dispute needs review!',
          embeds: [disputeEmbed],
        });
      }

      await interaction.update({
        content: `⚠️ Dispute filed. Staff have been notified. Scrim ID: \`${scrimId}\``,
        embeds: [disputeEmbed],
        components: [],
      });
    }
  },
};
