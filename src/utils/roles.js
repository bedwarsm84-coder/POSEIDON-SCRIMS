// ── Automatic Role Management ────────────────────────────────────
// Assigns Discord roles based on ELO tier and clan leader status.
// All role IDs come from .env so the bot works on any server.

// Maps ELO tier name → env variable name
const RANK_ROLE_ENV = {
  Legend:   'ROLE_LEGEND',
  Champion: 'ROLE_CHAMPION',
  Master:   'ROLE_MASTER',
  Diamond:  'ROLE_DIAMOND',
  Platinum: 'ROLE_PLATINUM',
  Gold:     'ROLE_GOLD',
  Silver:   'ROLE_SILVER',
  Bronze:   'ROLE_BRONZE',
};

const ALL_RANK_ROLE_IDS = () =>
  Object.values(RANK_ROLE_ENV)
    .map(key => process.env[key])
    .filter(Boolean);

/**
 * Assign the correct rank role to a Discord member, removing all others.
 * @param {GuildMember} member  - Discord.js GuildMember
 * @param {string} tierName     - e.g. 'Gold', 'Diamond'
 */
async function assignRankRole(member, tierName) {
  if (!member) return;
  const targetRoleId = process.env[RANK_ROLE_ENV[tierName]];
  if (!targetRoleId) return; // role not configured, skip silently

  const allRankIds = ALL_RANK_ROLE_IDS();

  try {
    // Remove all existing rank roles first
    const toRemove = member.roles.cache.filter(r => allRankIds.includes(r.id));
    if (toRemove.size) await member.roles.remove([...toRemove.keys()]);

    // Add the correct rank role
    await member.roles.add(targetRoleId);
  } catch (err) {
    console.warn(`[ROLES] Could not assign rank role to ${member.user.tag}:`, err.message);
  }
}

/**
 * Assign or remove the Clan Leader role.
 * @param {GuildMember} member
 * @param {boolean} isLeader
 */
async function assignLeaderRole(member, isLeader) {
  if (!member) return;
  const roleId = process.env.CLAN_LEADER_ROLE;
  if (!roleId) return;

  try {
    if (isLeader) {
      await member.roles.add(roleId);
    } else {
      await member.roles.remove(roleId).catch(() => {});
    }
  } catch (err) {
    console.warn(`[ROLES] Could not assign leader role to ${member.user.tag}:`, err.message);
  }
}

/**
 * Update rank + leader roles for all members of a clan.
 * Call this after ELO changes (scrim confirmed) or clan changes (register/disband).
 * @param {Guild} guild       - Discord.js Guild
 * @param {ClanDoc} clan      - Mongoose Clan document
 * @param {boolean} disband   - If true, remove all roles from members
 */
async function syncClanRoles(guild, clan, disband = false) {
  if (!guild) return;

  const tier = clan.rank ?? { name: 'Bronze' };

  for (const memberId of clan.memberIds) {
    const guildMember = await guild.members.fetch(memberId).catch(() => null);
    if (!guildMember) continue;

    if (disband) {
      // Remove rank role and leader role
      const allRankIds = ALL_RANK_ROLE_IDS();
      const toRemove = guildMember.roles.cache.filter(r =>
        allRankIds.includes(r.id) || r.id === process.env.CLAN_LEADER_ROLE
      );
      if (toRemove.size) await guildMember.roles.remove([...toRemove.keys()]).catch(() => {});
    } else {
      await assignRankRole(guildMember, tier.name);
      await assignLeaderRole(guildMember, memberId === clan.leaderId);
    }
  }
}

module.exports = { assignRankRole, assignLeaderRole, syncClanRoles };
