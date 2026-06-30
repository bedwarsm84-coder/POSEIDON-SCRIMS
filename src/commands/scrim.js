const { SlashCommandBuilder } = require('discord.js');
const Clan   = require('../models/Clan');
const Queue  = require('../models/Queue');
const Scrim  = require('../models/Scrim');
const { tryMatch, MAPS }    = require('../utils/matchmaking');
const {
  queueEmbed, scrimLiveEmbed, resultSubmittedEmbed,
  errorEmbed, successEmbed, confirmButtons,
} = require('../utils/embeds');

const MODES = ['BW-4v4','BW-2v2','SW-4v4','SW-2v2'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('scrim')
    .setDescription('Scrim queue & management')

    // /scrim queue
    .addSubcommand(sub => sub
      .setName('queue')
      .setDescription('Queue your clan for a scrim')
      .addStringOption(o => o
        .setName('mode').setDescription('Game mode').setRequired(true)
        .addChoices(...MODES.map(m => ({ name: m, value: m })))
      )
      .addStringOption(o => o
        .setName('map').setDescription('Preferred map (optional)')
        .addChoices(
          { name: 'Any', value: 'Any' },
          { name: 'Breeze', value: 'Breeze' },
          { name: 'Ascent', value: 'Ascent' },
          { name: 'Icebox', value: 'Icebox' },
          { name: 'Pearl',  value: 'Pearl'  },
          { name: 'Lotus',  value: 'Lotus'  },
        )
      )
    )

    // /scrim leave
    .addSubcommand(sub => sub
      .setName('leave')
      .setDescription('Leave the scrim queue')
    )

    // /scrim status
    .addSubcommand(sub => sub
      .setName('status')
      .setDescription('Show current queue')
    )

    // /scrim start
    .addSubcommand(sub => sub
      .setName('start')
      .setDescription('Mark your scrim as started')
      .addStringOption(o => o.setName('scrim_id').setDescription('Scrim ID from match notification').setRequired(true))
    )

    // /scrim result
    .addSubcommand(sub => sub
      .setName('result')
      .setDescription('Submit your scrim result')
      .addStringOption(o => o.setName('scrim_id').setDescription('Scrim ID').setRequired(true))
      .addIntegerOption(o => o.setName('your_score').setDescription('Your clan\'s score').setRequired(true).setMinValue(0).setMaxValue(99))
      .addIntegerOption(o => o.setName('opp_score').setDescription('Opponent\'s score').setRequired(true).setMinValue(0).setMaxValue(99))
      .addStringOption(o => o.setName('proof').setDescription('Screenshot URL (Imgur, etc.)').setRequired(true))
    )

    // /scrim cancel
    .addSubcommand(sub => sub
      .setName('cancel')
      .setDescription('Cancel a scheduled scrim')
      .addStringOption(o => o.setName('scrim_id').setDescription('Scrim ID').setRequired(true))
    ),

  async execute(interaction) {
    const sub    = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    // ── QUEUE ──────────────────────────────────────────────────────
    if (sub === 'queue') {
      const mode    = interaction.options.getString('mode');
      const mapPref = interaction.options.getString('map') || 'Any';

      // Must be a clan leader
      const clan = await Clan.findOne({ leaderId: userId });
      if (!clan) return interaction.reply({ embeds: [errorEmbed('Only clan leaders can queue. Register a clan with `/clan register`.')], ephemeral: true });

      // Min member check
      const minSize = mode.includes('4v4') ? 4 : 2;
      if (clan.memberIds.length < minSize) return interaction.reply({
        embeds: [errorEmbed(`You need at least **${minSize} members** for ${mode}. You have ${clan.memberIds.length}.`)],
        ephemeral: true,
      });

      // Already queued?
      if (await Queue.findOne({ clanId: clan._id })) return interaction.reply({
        embeds: [errorEmbed('Your clan is already in queue. Use `/scrim leave` first.')],
        ephemeral: true,
      });

      await interaction.deferReply();

      const entry = await Queue.create({ clanId: clan._id, clanName: clan.name, leaderId: userId, mode, mapPref });
      const match = await tryMatch(entry, Clan);

      if (match) {
        const { scrim, clan1, clan2 } = match;

        // Post in results channel
        const resultsChannel = interaction.guild.channels.cache.get(process.env.SCRIM_RESULTS_CHANNEL);
        if (resultsChannel) {
          const embed = scrimLiveEmbed(scrim, clan1, clan2);
          const msg   = await resultsChannel.send({
            content: `<@${clan1.leaderId}> <@${clan2.leaderId}> — your scrim is ready!`,
            embeds: [embed],
          });
          // Save message ref for later editing
          await Scrim.findByIdAndUpdate(scrim._id, { embedMessageId: msg.id, embedChannelId: resultsChannel.id });
        }

        await interaction.editReply({
          content: `🔱 Match found!`,
          embeds: [scrimLiveEmbed(scrim, clan1, clan2)],
        });
      } else {
        // Show queue
        const all = await Queue.find().sort({ queuedAt: 1 });
        await interaction.editReply({ embeds: [queueEmbed(all)] });
      }
    }

    // ── LEAVE QUEUE ─────────────────────────────────────────────────
    else if (sub === 'leave') {
      const clan = await Clan.findOne({ leaderId: userId });
      if (!clan) return interaction.reply({ embeds: [errorEmbed('You are not a clan leader.')], ephemeral: true });

      const del = await Queue.findOneAndDelete({ clanId: clan._id });
      if (!del) return interaction.reply({ embeds: [errorEmbed('Your clan is not in queue.')], ephemeral: true });

      await interaction.reply({ embeds: [successEmbed(`**[${clan.tag}]** left the queue.`)], ephemeral: true });
    }

    // ── STATUS ──────────────────────────────────────────────────────
    else if (sub === 'status') {
      const entries = await Queue.find().sort({ queuedAt: 1 });
      await interaction.reply({ embeds: [queueEmbed(entries)] });
                                                                    }
