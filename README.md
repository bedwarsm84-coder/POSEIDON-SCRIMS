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
