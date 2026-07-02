const { SlashCommandBuilder } = require('discord.js');
const Clan = require('../models/Clan');
const { clanInfoEmbed, errorEmbed, successEmbed } = require('../utils/embeds');
const { assignLeaderRole, syncClanRoles } = require('../utils/roles');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clan')
    .setDescription('Clan management')

    .addSubcommand(sub => sub
      .setName('register')
      .setDescription('Register a new clan')
      .addStringOption(o => o.setName('name').setDescription('Clan name').setRequired(true))
      .addStringOption(o => o.setName('tag').setDescription('Short tag (max 6 chars)').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('info')
      .setDescription('View a clan\'s stats')
      .addStringOption(o => o.setName('tag').setDescription('Clan tag').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('invite')
      .setDescription('Invite a player to your clan')
      .addUserOption(o => o.setName('player').setDescription('Discord user to invite').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('kick')
      .setDescription('Kick a player from your clan')
      .addUserOption(o => o.setName('player').setDescription('Discord user to kick').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('leave')
      .setDescription('Leave your current clan')
    )
    .addSubcommand(sub => sub
      .setName('transfer')
      .setDescription('Transfer clan leadership to another member')
      .addUserOption(o => o.setName('player').setDescription('New leader').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('disband')
      .setDescription('Disband your clan (irreversible!)')
    ),

  async execute(interaction) {
    const sub    = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const guild  = interaction.guild;

    // ── REGISTER ──────────────────────────────────────────────────
    if (sub === 'register') {
      const name = interaction.options.getString('name').trim();
      const tag  = interaction.options.getString('tag').trim().toUpperCase().slice(0, 6);

      const existing = await Clan.findOne({ memberIds: userId });
      if (existing) return interaction.reply({
        embeds: [errorEmbed(`You're already in **[${existing.tag}] ${existing.name}**. Leave first.`)],
        ephemeral: true,
      });

      if (await Clan.findOne({ $or: [{ name }, { tag }] })) return interaction.reply({
        embeds: [errorEmbed('That clan name or tag is already taken.')],
        ephemeral: true,
      });

      const clan = await Clan.create({ name, tag, leaderId: userId, memberIds: [userId] });

      // Assign Clan Leader role
      const member = await guild.members.fetch(userId).catch(() => null);
      await assignLeaderRole(member, true);

      await interaction.reply({
        embeds: [successEmbed(`Clan **[${clan.tag}] ${clan.name}** has been registered! 🔱`)],
      });
    }

    // ── INFO ──────────────────────────────────────────────────────
    else if (sub === 'info') {
      const tag  = interaction.options.getString('tag').toUpperCase();
      const clan = await Clan.findOne({ tag });
      if (!clan) return interaction.reply({ embeds: [errorEmbed(`Clan \`[${tag}]\` not found.`)], ephemeral: true });
      await interaction.reply({ embeds: [clanInfoEmbed(clan)] });
    }

    // ── INVITE ────────────────────────────────────────────────────
    else if (sub === 'invite') {
      const target = interaction.options.getUser('player');
      const clan   = await Clan.findOne({ leaderId: userId });
      if (!clan) return interaction.reply({ embeds: [errorEmbed('You are not a clan leader.')], ephemeral: true });
      if (clan.memberIds.length >= 8) return interaction.reply({ embeds: [errorEmbed('Clan is full (max 8 members).')], ephemeral: true });
      if (clan.memberIds.includes(target.id)) return interaction.reply({ embeds: [errorEmbed('That player is already in your clan.')], ephemeral: true });

      const other = await Clan.findOne({ memberIds: target.id });
      if (other) return interaction.reply({ embeds: [errorEmbed(`${target.username} is already in **[${other.tag}]**.`)], ephemeral: true });

      clan.memberIds.push(target.id);
      await clan.save();

      // Assign rank role to new member
      const member = await guild.members.fetch(target.id).catch(() => null);
      if (member && clan.rank) {
        const { assignRankRole } = require('../utils/roles');
        await assignRankRole(member, clan.rank.name);
      }

      await interaction.reply({ embeds: [successEmbed(`${target} has been added to **[${clan.tag}] ${clan.name}**!`)] });
    }

    // ── KICK ──────────────────────────────────────────────────────
    else if (sub === 'kick') {
      const target = interaction.options.getUser('player');
      const clan   = await Clan.findOne({ leaderId: userId });
      if (!clan) return interaction.reply({ embeds: [errorEmbed('You are not a clan leader.')], ephemeral: true });
      if (target.id === userId) return interaction.reply({ embeds: [errorEmbed("You can't kick yourself. Use /clan disband.")], ephemeral: true });
      if (!clan.memberIds.includes(target.id)) return interaction.reply({ embeds: [errorEmbed('That player is not in your clan.')], ephemeral: true });

      clan.memberIds = clan.memberIds.filter(id => id !== target.id);
      await clan.save();

      // Remove rank role from kicked member
      const member = await guild.members.fetch(target.id).catch(() => null);
      if (member) {
        const { assignRankRole } = require('../utils/roles');
        const allIds = ['ROLE_BRONZE','ROLE_SILVER','ROLE_GOLD','ROLE_PLATINUM','ROLE_DIAMOND','ROLE_MASTER','ROLE_CHAMPION','ROLE_LEGEND']
          .map(k => process.env[k]).filter(Boolean);
        const toRemove = member.roles.cache.filter(r => allIds.includes(r.id));
        if (toRemove.size) await member.roles.remove([...toRemove.keys()]).catch(() => {});
      }

      await interaction.reply({ embeds: [successEmbed(`${target} has been removed from **[${clan.tag}]**.`)] });
    }

    // ── LEAVE ─────────────────────────────────────────────────────
    else if (sub === 'leave') {
      const clan = await Clan.findOne({ memberIds: userId });
      if (!clan) return interaction.reply({ embeds: [errorEmbed('You are not in a clan.')], ephemeral: true });
      if (clan.leaderId === userId) return interaction.reply({
        embeds: [errorEmbed('You are the leader — use `/clan transfer` to pass leadership first, or `/clan disband` to delete the clan.')],
        ephemeral: true,
      });

      clan.memberIds = clan.memberIds.filter(id => id !== userId);
      await clan.save();

      // Remove rank role
      const member = await guild.members.fetch(userId).catch(() => null);
      if (member) {
        const allIds = ['ROLE_BRONZE','ROLE_SILVER','ROLE_GOLD','ROLE_PLATINUM','ROLE_DIAMOND','ROLE_MASTER','ROLE_CHAMPION','ROLE_LEGEND']
          .map(k => process.env[k]).filter(Boolean);
        const toRemove = member.roles.cache.filter(r => allIds.includes(r.id));
        if (toRemove.size) await member.roles.remove([...toRemove.keys()]).catch(() => {});
      }

      await interaction.reply({ embeds: [successEmbed(`You have left **[${clan.tag}] ${clan.name}**.`)], ephemeral: true });
    }

    // ── TRANSFER ──────────────────────────────────────────────────
    else if (sub === 'transfer') {
      const target = interaction.options.getUser('player');
      const clan   = await Clan.findOne({ leaderId: userId });
      if (!clan) return interaction.reply({ embeds: [errorEmbed('You are not a clan leader.')], ephemeral: true });
      if (!clan.memberIds.includes(target.id)) return interaction.reply({ embeds: [errorEmbed('That player is not in your clan.')], ephemeral: true });
      if (target.id === userId) return interaction.reply({ embeds: [errorEmbed("You can't transfer leadership to yourself.")], ephemeral: true });

      clan.leaderId = target.id;
      await clan.save();

      // Swap leader roles
      const oldLeader = await guild.members.fetch(userId).catch(() => null);
      const newLeader = await guild.members.fetch(target.id).catch(() => null);
      await assignLeaderRole(oldLeader, false);
      await assignLeaderRole(newLeader, true);

      await interaction.reply({ embeds: [successEmbed(`Leadership of **[${clan.tag}] ${clan.name}** transferred to ${target}! 👑`)] });
    }

    // ── DISBAND ───────────────────────────────────────────────────
    else if (sub === 'disband') {
      const clan = await Clan.findOne({ leaderId: userId });
      if (!clan) return interaction.reply({ embeds: [errorEmbed('You are not a clan leader.')], ephemeral: true });

      // Remove all roles from all members
      await syncClanRoles(guild, clan, true);

      await Clan.deleteOne({ _id: clan._id });
      await interaction.reply({ embeds: [successEmbed(`**[${clan.tag}] ${clan.name}** has been disbanded.`)] });
    }
  },
};
