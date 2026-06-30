# 🔱 POSEIDON SCRIMS — Discord Bot

Full-auto Bedwars & Skywars scrim bot with MongoDB, auto-matchmaking, leaderboards and result verification.

---

## ⚡ Quick Setup (step by step)

### 1. Create a Discord Bot
1. Go to [discord.com/developers/applications](https://discord.com/developers/applications)
2. Click **New Application** → name it `POSEIDON SCRIMS`
3. Go to **Bot** tab → click **Add Bot**
4. Under **Token** → click **Reset Token** and copy it → this is your `DISCORD_TOKEN`
5. Copy the **Application ID** from **General Information** → this is your `CLIENT_ID`
6. Under **Bot** → enable **Server Members Intent** and **Message Content Intent**

### 2. Invite the Bot to your Server
1. Go to **OAuth2 → URL Generator**
2. Check scopes: `bot`, `applications.commands`
3. Check permissions: `Send Messages`, `Embed Links`, `Read Message History`, `Manage Messages`
4. Copy the URL and open it → select your server

### 3. MongoDB Atlas (free tier works!)
1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) → create a free account
2. Create a **Free M0 Cluster**
3. Under **Database Access** → Add a user with password
4. Under **Network Access** → Add IP `0.0.0.0/0` (allow all) or your server's IP
5. Click **Connect** → **Drivers** → copy the connection string
6. Replace `<password>` with your actual password → this is your `MONGODB_URI`

### 4. Get your Channel & Role IDs
In Discord:
- Go to **User Settings → Advanced → Enable Developer Mode**
- Right-click any channel → **Copy ID**
- Right-click any role → **Copy ID**

### 5. Install & Configure
```bash
# Clone / download this folder
cd poseidon-bot

# Install dependencies
npm install

# Copy env template
cp .env.example .env

# Edit .env with your values
nano .env   # or open in any text editor
```

Fill in **all values** in `.env`:
DISCORD_TOKEN=       ← from step 1

CLIENT_ID=           ← from step 1

GUILD_ID=            ← right-click your server → Copy ID

MONGODB_URI=         ← from step 3
SCRIM_RESULTS_CHANNEL=   ← #scrim-results channel ID

LEADERBOARD_CHANNEL=     ← #leaderboard channel ID

LOG_CHANNEL=             ← #logs (staff) channel ID

QUEUE_CHANNEL=           ← #looking-for-scrim channel ID

ANNOUNCEMENTS_CHANNEL=   ← optional, not used by bot logic yet
VERIFIED_ROLE=       ← optional, not used by bot logic yet

CLAN_LEADER_ROLE=    ← optional, not used by bot logic yet

STAFF_ROLE=          ← your staff/mod role ID (used for dispute pings)
> 💡 Only `SCRIM_RESULTS_CHANNEL`, `LEADERBOARD_CHANNEL`, `LOG_CHANNEL` and `STAFF_ROLE` are actively used by the bot right now. The others are reserved for future features — fill them in if you have them, or leave a placeholder.

### 6. Deploy Commands & Start
```bash
# Deploy slash commands to your server (only needs to run once)
npm run deploy

# Start the bot
npm start

# Or for development with auto-restart:
npm run dev
```

---

## 🎮 Bot Commands

### Clan Commands
| Command | Who | Description |
|---|---|---|
| `/clan register [name] [tag]` | Anyone | Create a new clan |
| `/clan info [tag]` | Anyone | View clan stats |
| `/clan invite [@user]` | Leader | Add a member |
| `/clan kick [@user]` | Leader | Remove a member |
| `/clan disband` | Leader | Delete your clan |

### Scrim Commands
| Command | Who | Description |
|---|---|---|
| `/scrim queue [mode] [map?]` | Clan Leader | Join the scrim queue |
| `/scrim leave` | Clan Leader | Leave the queue |
| `/scrim status` | Anyone | View current queue |
| `/scrim start [id]` | Clan Leader | Mark scrim as live |
| `/scrim result [id] [your_score] [opp_score] [proof_url]` | Clan Leader | Submit result |
| `/scrim cancel [id]` | Clan Leader | Cancel a scrim |

### Info Commands
| Command | Who | Description |
|---|---|---|
| `/leaderboard [season?]` | Anyone | Show clan rankings (sorted by ELO) |
| `/stats clan [tag]` | Anyone | Clan stats — ELO, rank tier, streak, peak ELO |
| `/stats player` | Anyone | Your own clan stats |
| `/stats history [tag]` | Anyone | Last 5 results |

### Admin Commands (Staff Only)
| Command | Description |
|---|---|
| `/admin forceres [id] [winner] [s1] [s2]` | Force a result (calculates ELO automatically) |
| `/admin updatelb` | Post/refresh leaderboard embed |
| `/admin resetseason [n]` | Reset all stats for new season (ELO resets to 1000) |
| `/admin clandelete [tag]` | Delete a clan |

---

## ⚡ ELO Rating System

Clans start at **1000 ELO**. After each confirmed scrim, both clans' ratings update automatically:

- **Underdog bonus** — beating a much stronger clan earns significantly more ELO than expected
- **Dynamic K-factor** — new clans (under 10 scrims) move fast to find their real rank quickly; established clans move slower for leaderboard stability
- **Dominance bonus** — winning by a bigger score margin gives a slightly bigger ELO swing (capped)
- **Streaks** — 3+ wins in a row give a small bonus; 3+ losses in a row soften the next loss (mercy rule)

**Rank tiers:** 🥉 Bronze (0–999) · 🥈 Silver (1000–1199) · 🥇 Gold (1200–1399) · 💠 Platinum (1400–1599) · 💎 Diamond (1600–1799) · 🏆 Master (1800–1999) · 👑 Champion (2000–2199) · 🔱 Legend (2200+)

---

## 🔄 How Scrims Work (Auto-Flow)
Clan A: /scrim queue BW-4v4

↓
Clan B: /scrim queue BW-4v4

↓ (bot finds a match instantly)
Bot posts match embed in #scrim-results

Bot DMs both leaders with scrim ID + map

↓
Both teams ready → /scrim start [id]

↓
Play the scrim!

↓
Winner: /scrim result [id] [your] [opp] [screenshot]

↓
Bot DMs opponent leader with Confirm / Dispute buttons

↓
Confirmed → stats updated, leaderboard refreshed

Disputed  → staff pinged in #logs for review
---

## 🏗️ Project Structure
poseidon-bot/
  src/
    index.js                Bot entry point (starts Discord client + API server)
    deploy-commands.js      Register slash commands

    api/
      server.js             Express API (powers the web dashboard)

    commands/
      clan.js                /clan commands
      scrim.js                /scrim commands
      leaderboard.js          /leaderboard + /stats
      admin.js                /admin commands

    events/
      ready.js                Bot startup
      interactionCreate.js    Command + button handler

    models/
      Clan.js                 MongoDB clan schema (ELO, rank, streak)
      Scrim.js                MongoDB scrim schema
      Queue.js                MongoDB queue schema

    utils/
      elo.js                  ELO rating calculation
      embeds.js                All Discord embed builders
      matchmaking.js          Auto-matchmaking logic

  .env.example               Config template
  package.json
  README.md
  ---

## 🚀 Hosting (Free Options)

| Platform | Notes |
|---|---|
| **Railway** | Easy, $5 free credit/month, auto-deploys from GitHub |
| **Render** | Free tier, spins down after inactivity (use a cron ping) |
| **Oracle Cloud** | Always free VM, best for production |
| **Your own VPS** | DigitalOcean/Hetzner ~€4/month |

For Railway (recommended for beginners):
1. Push to GitHub
2. Go to railway.app → New Project → Deploy from GitHub
3. Add all env vars in the Railway dashboard
4. It auto-starts!
5. In **Settings → Networking**, click **Generate Domain** to get a public URL for the API (e.g. `your-bot.up.railway.app`) — needed for the dashboard below

---

## 🌊 Web Dashboard (Optional)

A standalone HTML dashboard (`index.html`) is included that shows a live leaderboard, live scrims, and clan stats — pulled straight from the bot's database via the Express API (`src/api/server.js`). It's fully optional; the Discord bot works completely on its own without it.

### How it works
Discord Bot ──writes──> MongoDB <──reads── Express API ──JSON──> Dashboard (index.html)
The Express API starts automatically alongside the bot (see `src/index.js`) and exposes:
- `GET /api/leaderboard` — clan rankings sorted by ELO
- `GET /api/scrims/live` — live/scheduled/recent scrims
- `GET /api/stats` — quick totals (clan count, scrims played)
- `GET /api/clan/:tag` — single clan details
- `GET /health` — health check

### Setting up your own dashboard
1. Make sure your bot is deployed (e.g. on Railway) and has a **public domain** generated (Settings → Networking → Generate Domain)
2. Open `index.html` and find this line near the bottom:
```js
   const API_BASE = 'https://YOUR-RAILWAY-URL-HERE.up.railway.app';
```
3. Replace it with **your own** bot's public URL
4. Host the HTML file anywhere that serves static files — easiest options:
   - **GitHub Pages** (free, recommended): push `index.html` to a repo → Settings → Pages → Deploy from branch `main` / root → live in ~1 minute
   - **Cloudflare Pages** or **Netlify** also work great for a single static file
5. Your dashboard is now live and auto-refreshes every 15 seconds

> ⚠️ The dashboard is read-only and has no authentication — anyone with the link can view your leaderboard and live scrims (not register clans or submit results; that still only happens through Discord). If you don't want that, keep the dashboard link private or add your own auth layer.

---

## 🔱 Built for POSEIDON SCRIMS
