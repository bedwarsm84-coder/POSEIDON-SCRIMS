const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const COLORS = {
  primary:  0x00DDFF,
  gold:     0xFFD60A,
  success:  0x00FF88,
  danger:   0xFF2D55,
  warning:  0xFF9500,
  neutral:  0x1E3A5F,
};

const TRIDENT = '🔱';

// ── Leaderboard embed ────────────────────────────────────────────
function leaderboardEmbed(clans, season) {
  const medals = ['🥇','🥈','🥉'];

  const rows = clans.slice(0, 10).map((c, i) => {
    const rank  = medals[i] || `\`${String(i + 1).padStart(2, ' ')}\``;
    const total = c.stats.wins + c.stats.losses;
    const wr    = total === 0 ? '—' : `${Math.round(c.stats.wins / total * 100)}%`;
    const kd    = c.stats.deaths === 0 ? c.stats.kills : (c.stats.kills / c.stats.deaths).toFixed(2);
    const tier  = c.rank ?? { emoji: '🥉' };
    const streak = c.stats.streak > 0 ? ` 🔥${c.stats.streak}` : '';
    return `${rank} ${tier.emoji} **[${c.tag}] ${c.name}** — ${c.stats.elo} ELO | ${c.stats.wins}W/${c.stats.losses}L | WR: ${wr} | KD: ${kd}${streak}`;
  });

  return new EmbedBuilder()
    .setColor(COLORS.gold)
    .setTitle(`${TRIDENT} POSEIDON SCRIMS — Season ${season} Leaderboard`)
    .setDescription(rows.join('\n') || '*No clans ranked yet.*')
    .setFooter({ text: `POSEIDON SCRIMS • Updated` })
    .setTimestamp();
}

// ── Scrim matched embed ──────────────────────────────────────────
function scrimMatchedEmbed(scrim, clan1, clan2) {
  return new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle(`⚡ SCRIM MATCHED`)
    .setDescription(`**[${clan1.tag}] ${clan1.name}** vs **[${clan2.tag}] ${clan2.name}**`)
    .addFields(
      { name: 'Mode',   value: scrim.mode,           inline: true },
      { name: 'Map',    value: scrim.map || 'TBD',   inline: true },
      { name: 'Status', value: '🟡 Scheduled',       inline: true },
    )
    .setFooter({ text: 'Use /scrim start once both teams are ready!' })
    .setTimestamp();
}

// ── Live scrim embed ─────────────────────────────────────────────
function scrimLiveEmbed(scrim, clan1, clan2) {
  return new EmbedBuilder()
    .setColor(COLORS.danger)
    .setTitle(`🔴 LIVE — ${clan1.name} vs ${clan2.name}`)
    .setDescription(`**Mode:** ${scrim.mode} | **Map:** ${scrim.map || 'TBD'}`)
    .addFields(
      { name: `[${clan1.tag}] ${clan1.name}`, value: `Score: **${scrim.score.clan1}**\nKills: ${scrim.kills.clan1}`, inline: true },
      { name: '\u200B', value: '**VS**', inline: true },
      { name: `[${clan2.tag}] ${clan2.name}`, value: `Score: **${scrim.score.clan2}**\nKills: ${scrim.kills.clan2}`, inline: true },
    )
    .setFooter({ text: `Scrim ID: ${scrim._id} • Submit result with /scrim result` })
    .setTimestamp();
}

// ── Result submitted embed ───────────────────────────────────────
function resultSubmittedEmbed(scrim, clan1, clan2, winner, loser) {
  return new EmbedBuilder()
    .setColor(COLORS.success)
    .setTitle(`✅ SCRIM RESULT — ${clan1.name} vs ${clan2.name}`)
    .setDescription(`🏆 **${winner.name}** wins!`)
    .addFields(
      { name: 'Final Score', value: `**${clan1.name}** ${scrim.score.clan1} — ${scrim.score.clan2} **${clan2.name}**`, inline: false },
      { name: 'Mode',   value: scrim.mode,         inline: true },
      { name: 'Map',    value: scrim.map || '—',   inline: true },
    )
    .setFooter({ text: 'Result pending opponent confirmation — ELO will update once confirmed' })
    .setTimestamp();
}

// ── Clan info embed ──────────────────────────────────────────────
function clanInfoEmbed(clan) {
  const total  = clan.stats.wins + clan.stats.losses;
  const wr     = total === 0 ? '—' : `${Math.round(clan.stats.wins / total * 100)}%`;
  const kd     = clan.stats.deaths === 0 ? `${clan.stats.kills}` : (clan.stats.kills / clan.stats.deaths).toFixed(2);
  const tier   = clan.rank ?? { emoji: '🥉', name: 'Bronze' };
  const streak = clan.stats.streak > 0 ? `🔥 ${clan.stats.streak} win streak` : clan.stats.streak < 0 ? `❄️ ${Math.abs(clan.stats.streak)} loss streak` : '—';

  return new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle(`${TRIDENT} [${clan.tag}] ${clan.name}`)
    .addFields(
      { name: '👑 Leader',  value: `<@${clan.leaderId}>`,           inline: true },
      { name: '👥 Members', value: `${clan.memberIds.length} / 8`,  inline: true },
      { name: '📅 Season',  value: `${clan.season}`,                inline: true },
      { name: `${tier.emoji} Rank`, value: tier.name,                inline: true },
      { name: '⚡ ELO',     value: `${clan.stats.elo}`,             inline: true },
      { name: '🏔️ Peak ELO',value: `${clan.stats.peakElo}`,        inline: true },
      { name: '🏆 Wins',    value: `${clan.stats.wins}`,            inline: true },
      { name: '💀 Losses',  value: `${clan.stats.losses}`,          inline: true },
      { name: '🎮 Scrims',  value: `${clan.stats.scrims}`,          inline: true },
      { name: '🎯 Win Rate',value: wr,                               inline: true },
      { name: '⚔️  K/D',    value: kd,                              inline: true },
      { name: '📈 Streak',  value: streak,                          inline: true },
    )
    .setFooter({ text: `POSEIDON SCRIMS • Season ${clan.season}` })
    .setTimestamp();
}

// ── Queue status embed ───────────────────────────────────────────
function queueEmbed(entries) {
  const lines = entries.map((e, i) =>
    `\`${i + 1}.\` **[${e.clanName}]** — ${e.mode} | Map: ${e.mapPref} | <t:${Math.floor(e.queuedAt / 1000)}:R>`
  );
  return new EmbedBuilder()
    .setColor(COLORS.warning)
    .setTitle('⏳ SCRIM QUEUE')
    .setDescription(lines.join('\n') || '*Queue is empty — be the first!*')
    .setFooter({ text: 'Use /scrim queue to join' })
    .setTimestamp();
}

// ── Error embed ──────────────────────────────────────────────────
function errorEmbed(msg) {
  return new EmbedBuilder().setColor(COLORS.danger).setDescription(`❌ ${msg}`);
}

// ── Success embed ────────────────────────────────────────────────
function successEmbed(msg) {
  return new EmbedBuilder().setColor(COLORS.success).setDescription(`✅ ${msg}`);
}

// ── Confirm/Dispute buttons ──────────────────────────────────────
function confirmButtons(scrimId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`confirm_result_${scrimId}`)
      .setLabel('✅ Confirm Result')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`dispute_result_${scrimId}`)
      .setLabel('⚠️ Dispute')
      .setStyle(ButtonStyle.Danger),
  );
}

module.exports = {
  leaderboardEmbed, scrimMatchedEmbed, scrimLiveEmbed,
  resultSubmittedEmbed, clanInfoEmbed, queueEmbed,
  errorEmbed, successEmbed, confirmButtons, COLORS,
};
