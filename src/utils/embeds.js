const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// ── Cyberpunk Atlantis Color Palette ────────────────────────────
const COLORS = {
  primary:  0x00FFEE,
  gold:     0xFFD60A,
  success:  0x00FF88,
  danger:   0xFF2D55,
  warning:  0xFF9500,
  neutral:  0x0A1628,
  purple:   0xBF00FF,
};

// ── UI Constants ─────────────────────────────────────────────────
const TRIDENT   = '🔱';
const DIV       = '▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰';
const DIV_SHORT = '▰▰▰▰▰▰▰▰▰▰▰▰';
const BULLET    = '▸';

// ── /leaderboard ─────────────────────────────────────────────────
function leaderboardEmbed(clans, season) {
  const medals = ['🥇', '🥈', '🥉'];

  const rows = clans.slice(0, 10).map((c, i) => {
    const rank   = medals[i] || `\`#${String(i + 1).padStart(2, '0')}\``;
    const total  = c.stats.wins + c.stats.losses;
    const wr     = total === 0 ? '—' : `${Math.round(c.stats.wins / total * 100)}%`;
    const kd     = c.stats.deaths === 0 ? c.stats.kills : (c.stats.kills / c.stats.deaths).toFixed(2);
    const tier   = c.rank ?? { emoji: '🥉' };
    const streak = c.stats.streak >= 3 ? ` 🔥**${c.stats.streak}**` : c.stats.streak <= -3 ? ` ❄️${Math.abs(c.stats.streak)}` : '';
    return `${rank} ${tier.emoji} **[${c.tag}] ${c.name}**\n> ⚡ \`${c.stats.elo} ELO\` ${BULLET} ${c.stats.wins}W/${c.stats.losses}L ${BULLET} WR: ${wr} ${BULLET} KD: ${kd}${streak}`;
  });

  return new EmbedBuilder()
    .setColor(COLORS.gold)
    .setTitle(`${TRIDENT}  POSEIDON SCRIMS — SEASON ${season}`)
    .setDescription(
      `\`\`\`ansi\n[2;36m⚡ LEADERBOARD PROTOCOL ACTIVE[0m\n\`\`\`` +
      `${DIV}\n\n` +
      (rows.join('\n\n') || '*— NO CLANS RANKED YET —*') +
      `\n\n${DIV}`
    )
    .setFooter({ text: `${TRIDENT} POSEIDON SCRIMS  •  SEASON ${season}  •  LIVE DATA` })
    .setTimestamp();
}

// ── /scrim queue → match found ────────────────────────────────────
function scrimMatchedEmbed(scrim, clan1, clan2) {
  return new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle(`⚡  MATCH FOUND — INITIATING SCRIM PROTOCOL`)
    .setDescription(
      `\`\`\`ansi\n[2;36m▸ MATCHMAKING COMPLETE[0m\n\`\`\`` +
      `${DIV}\n` +
      `**${BULLET} [${clan1.tag}] ${clan1.name}**\n` +
      `> ⚡ \`${clan1.stats?.elo ?? 1000} ELO\`\n\n` +
      `\`\`\`\n         — VS —\n\`\`\`` +
      `**${BULLET} [${clan2.tag}] ${clan2.name}**\n` +
      `> ⚡ \`${clan2.stats?.elo ?? 1000} ELO\`\n` +
      `${DIV}`
    )
    .addFields(
      { name: '🗺️  MAP',       value: `\`${scrim.map || 'TBD'}\``,  inline: true },
      { name: '🎮  MODE',      value: `\`${scrim.mode}\``,           inline: true },
      { name: '📋  SCRIM ID',  value: `\`${scrim._id}\``,            inline: false },
    )
    .setFooter({ text: `${TRIDENT} Both leaders: /scrim start [id] when ready` })
    .setTimestamp();
}

// ── /scrim start → live embed ─────────────────────────────────────
function scrimLiveEmbed(scrim, clan1, clan2) {
  const s1 = scrim.score?.clan1 ?? 0;
  const s2 = scrim.score?.clan2 ?? 0;

  return new EmbedBuilder()
    .setColor(COLORS.danger)
    .setTitle(`🔴  LIVE SCRIM — ${clan1.name}  vs  ${clan2.name}`)
    .setDescription(
      `\`\`\`ansi\n[2;31m▸ COMBAT PROTOCOL ACTIVE[0m\n\`\`\`` +
      `${DIV}\n` +
      `\`\`\`\n  ${clan1.name.padEnd(14)} ${String(s1).padStart(2)}  —  ${String(s2).padEnd(2)} ${clan2.name}\n\`\`\`` +
      `${DIV}`
    )
    .addFields(
      { name: '🗺️  MAP',   value: `\`${scrim.map || 'TBD'}\``,  inline: true },
      { name: '🎮  MODE',  value: `\`${scrim.mode}\``,           inline: true },
    )
    .setFooter({ text: `${TRIDENT} ID: ${scrim._id}  •  /scrim result [id] to submit` })
    .setTimestamp();
}

// ── /scrim result → pending confirm ──────────────────────────────
function resultSubmittedEmbed(scrim, clan1, clan2, winner, loser) {
  const s1 = scrim.score?.clan1 ?? 0;
  const s2 = scrim.score?.clan2 ?? 0;

  return new EmbedBuilder()
    .setColor(COLORS.success)
    .setTitle(`${TRIDENT}  SCRIM RESULT SUBMITTED`)
    .setDescription(
      `\`\`\`ansi\n[2;32m▸ AWAITING CONFIRMATION[0m\n\`\`\`` +
      `${DIV}\n` +
      `🏆  **${winner.name}** WINS\n\n` +
      `\`\`\`\n  ${clan1.name.padEnd(14)} ${String(s1).padStart(2)}  —  ${String(s2).padEnd(2)} ${clan2.name}\n\`\`\`` +
      `${DIV}`
    )
    .addFields(
      { name: '🎮  MODE',  value: `\`${scrim.mode}\``,          inline: true },
      { name: '🗺️  MAP',   value: `\`${scrim.map || '—'}\``,   inline: true },
    )
    .setFooter({ text: `${TRIDENT} ELO updates once opponent confirms` })
    .setTimestamp();
}

// ── /clan info & /stats clan ──────────────────────────────────────
function clanInfoEmbed(clan) {
  const total  = clan.stats.wins + clan.stats.losses;
  const wr     = total === 0 ? '—' : `${Math.round(clan.stats.wins / total * 100)}%`;
  const kd     = clan.stats.deaths === 0 ? `${clan.stats.kills}` : (clan.stats.kills / clan.stats.deaths).toFixed(2);
  const tier   = clan.rank ?? { emoji: '🥉', name: 'Bronze', color: '#CD7F32' };
  const streak = clan.stats.streak > 0
    ? `🔥 ${clan.stats.streak} WIN STREAK`
    : clan.stats.streak < 0
    ? `❄️ ${Math.abs(clan.stats.streak)} LOSS STREAK`
    : '—';

  return new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle(`${TRIDENT}  [${clan.tag}]  ${clan.name.toUpperCase()}`)
    .setDescription(
      `\`\`\`ansi\n[2;36m${tier.emoji}  ${tier.name.toUpperCase()}  •  ⚡ ${clan.stats.elo} ELO[0m\n\`\`\`` +
      `${DIV}`
    )
    .addFields(
      { name: '▰ SEASON STATS', value:
        `🏆 Wins \`${clan.stats.wins}\`\n` +
        `💀 Losses \`${clan.stats.losses}\`\n` +
        `🎯 Win Rate \`${wr}\`\n` +
        `⚔️ K/D \`${kd}\`\n` +
        `📈 Streak \`${streak}\`\n` +
        `🏔️ Peak ELO \`${clan.stats.peakElo}\``,
        inline: true
      },
      { name: '▰ ROSTER', value:
        `👑 Leader <@${clan.leaderId}>\n` +
        `👥 Members \`${clan.memberIds.length} / 8\`\n` +
        `🎮 Scrims \`${clan.stats.scrims}\`\n` +
        `📅 Season \`${clan.season}\``,
        inline: true
      },
    )
    .setFooter({ text: `${TRIDENT} POSEIDON SCRIMS  •  SEASON ${clan.season}` })
    .setTimestamp();
}

// ── /scrim status → queue list ────────────────────────────────────
function queueEmbed(entries) {
  const lines = entries.map((e, i) =>
    `\`#${i + 1}\` **[${e.clanName}]**\n> 🎮 \`${e.mode}\` ${BULLET} 🗺️ \`${e.mapPref}\` ${BULLET} ⏱️ <t:${Math.floor(new Date(e.queuedAt).getTime() / 1000)}:R>`
  );

  return new EmbedBuilder()
    .setColor(COLORS.warning)
    .setTitle(`⏳  SCRIM QUEUE — ${entries.length} CLAN${entries.length !== 1 ? 'S' : ''} WAITING`)
    .setDescription(
      `\`\`\`ansi\n[2;33m▸ MATCHMAKING PROTOCOL SCANNING...[0m\n\`\`\`` +
      `${DIV}\n\n` +
      (lines.join('\n\n') || '*— QUEUE EMPTY — BE THE FIRST —*') +
      `\n\n${DIV}`
    )
    .setFooter({ text: `${TRIDENT} /scrim queue [mode] to join` })
    .setTimestamp();
}

// ── Error embed ───────────────────────────────────────────────────
function errorEmbed(msg) {
  return new EmbedBuilder()
    .setColor(COLORS.danger)
    .setDescription(`\`\`\`ansi\n[2;31m✖  SYSTEM ERROR[0m\n\`\`\`${DIV_SHORT}\n❌  ${msg}\n${DIV_SHORT}`);
}

// ── Success embed ─────────────────────────────────────────────────
function successEmbed(msg) {
  return new EmbedBuilder()
    .setColor(COLORS.success)
    .setDescription(`\`\`\`ansi\n[2;32m✔  SYSTEM OK[0m\n\`\`\`${DIV_SHORT}\n✅  ${msg}\n${DIV_SHORT}`);
}

// ── Confirm/Dispute buttons ───────────────────────────────────────
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
