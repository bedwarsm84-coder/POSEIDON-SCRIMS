const {
  SlashCommandBuilder, PermissionFlagsBits
} = require('discord.js');
const Clan = require('../models/Clan');
const { clanInfoEmbed, errorEmbed, successEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clan')
    .setDescription('Clan management')

    // /clan register
    .addSubcommand(sub => sub
      .setName('register')
      .setDescription('Register a new clan')
      .addStringOption(o => o.setName('name').setDescription('Clan name').setRequired(true))
      .addStringOption(o => o.setName('tag').setDescription('Short tag (max 6 chars)').setRequired(true))
    )

    // /clan info
    .addSubcommand(sub => sub
      .setName('info')
      .setDescription('View a clan\'s stats')
      .addStringOption(o => o.setName('tag').setDescription('Clan tag').setRequired(true))
    )

    // /clan invite
    .addSubcommand(sub => sub
      .setName('invite')
      .setDescription('Invite a player to your clan')
      .addUserOption(o => o.setName('player').setDescription('Discord user to invite').setRequired(true))
    )

    // /clan kick
    .addSubcommand(sub => sub
      .setName('kick')
      .setDescription('Kick a player from your clan')
      .addUserOption(o => o.setName('player').setDescription('Discord user to kick').setRequired(true))
    )

    // /clan disband
    .addSubcommand(sub => sub
      .setName('disband')
      .setDescription('Disband your clan (irreversible!)')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    // ── REGISTER ──
    if (sub === 'register') {
      const name = interaction.options.getString('name').trim();
      const tag  = interaction.options.getString('tag').trim().toUpperCase().slice(0, 6);

      // Already in a clan?
      const existing = await Clan.findOne({ memberIds: userId });
      if (existing) return interaction.reply({
        embeds: [errorEmbed(`You're already in **[${existing.tag}] ${existing.name}**. Leave first.`)],
        ephemeral: true,
      });

      // Name/tag taken?
      if (await Clan.findOne({ $or: [{ name }, { tag }] })) return interaction.reply({
        embeds: [errorEmbed(`That clan name or tag is already taken.`)],
        ephemeral: true,
      });

      const clan = await Clan.create({ name, tag, leaderId: userId, memberIds: [userId] });

      await interaction.reply({
        embeds: [successEmbed(`Clan **[${clan.tag}] ${clan.name}** has been registered! 🔱`)],
      });
    }

    // ── INFO ──
    else if (sub === 'info') {
      const tag  = interaction.options.getString('tag').toUpperCase();
      const clan = await Clan.findOne({ tag });
      if (!clan) return interaction.reply({ embeds: [errorEmbed(`Clan \`[${tag}]\` not found.`)], ephemeral: true });
      await interaction.reply({ embeds: [clanInfoEmbed(clan)] });
    }

    // ── INVITE ──
    else if (sub === 'invite') {
      const target = interaction.options.getUser('player');
      const clan   = await Clan.findOne({ leaderId: userId });
      if (!clan) return interaction.reply({ embeds: [errorEmbed('You are not a clan leader.')], ephemeral: true });
      if (clan.memberIds.length >= 8) return interaction.reply({ embeds: [errorEmbed('Clan is full (max 8 members).')], ephemeral: true });
      if (clan.memberIds.includes(target.id)) return interaction.reply({ embeds: [errorEmbed('That player is already in your clan.')], ephemeral: true });

      // Check target not in another clan
      const other = await Clan.findOne({ memberIds: target.id });
      if (other) return interaction.reply({ embeds: [errorEmbed(`${target.username} is already in **[${other.tag}]**.`)], ephemeral: true });

      clan.memberIds.push(target.id);
      await clan.save();
      await interaction.reply({ embeds: [successEmbed(`${target} has been added to **[${clan.tag}] ${clan.name}**!`)] });
    }

    // ── KICK ──
    else if (sub === 'kick') {
      const target = interaction.options.getUser('player');
      const clan   = await Clan.findOne({ leaderId: userId });
      if (!clan) return interaction.reply({ embeds: [errorEmbed('You are not a clan leader.')], ephemeral: true });
      if (target.id === userId) return interaction.reply({ embeds: [errorEmbed("You can't kick yourself. Use /clan disband.")], ephemeral: true });
      if (!clan.memberIds.includes(target.id)) return interaction.reply({ embeds: [errorEmbed('That player is not in your clan.')], ephemeral: true });

      clan.memberIds = clan.memberIds.filter(id => id !== target.id);
      await clan.save();
      await interaction.reply({ embeds: [successEmbed(`${target} has been removed from **[${clan.tag}]**.`)] });
    }

    // ── DISBAND ──
    else if (sub === 'disband') {
      const clan = await Clan.findOne({ leaderId: userId });
      if (!clan) return interaction.reply({ embeds: [errorEmbed('You are not a clan leader.')], ephemeral: true });
      await Clan.deleteOne({ _id: clan._id });
      await interaction.reply({ embeds: [successEmbed(`**[${clan.tag}] ${clan.name}** has been disbanded.`)] });
    }
  },
};
