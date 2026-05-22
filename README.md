# ⚔ Iron Veil Clan — Guild Tracker

Real-time attendance and DKP bidding tracker for Legend of Ymir.
Built with **React + Vite**, **Supabase**, and **Discord OAuth**.

---

## Role System

| Discord Role | App Access |
|---|---|
| **Admiral** | Full admin — manage members, events, items |
| **Fidelis** | Member — view roster, events, place bids |
| **Infidels / none** | Access denied |

---

## Setup Guide

### Step 1 — Supabase Project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Name it `ymir-guild`, set a DB password, pick Singapore region
3. Wait ~1 min to provision

### Step 2 — Run the Database Schema

1. Supabase dashboard → **SQL Editor**
2. Paste the entire contents of `supabase/schema.sql` and click **Run**

### Step 3 — Enable Discord OAuth in Supabase

1. In Supabase → **Authentication → Providers → Discord**
2. Toggle **Enable Discord provider** ON
3. You'll need a **Client ID** and **Client Secret** from Discord — keep this page open

### Step 4 — Create a Discord OAuth App

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications)
2. Click **New Application** → name it `Ymir Guild Tracker`
3. Go to **OAuth2** in the left sidebar
4. Copy the **Client ID** and **Client Secret** → paste into Supabase Discord provider settings
5. Under **Redirects**, click **Add Redirect** and add:
   ```
   https://your-project-id.supabase.co/auth/v1/callback
   ```
   (Replace `your-project-id` with your actual Supabase project ID)
6. Save changes in both Discord and Supabase

### Step 5 — Enable `guilds.members.read` Scope

This is critical — it allows the app to check your Discord server roles.

1. In your Discord OAuth2 app → **OAuth2 → General**
2. Under **Default Authorization Link**, make sure `guilds.members.read` is available
3. In Supabase → Discord provider settings, add to **Additional Scopes**:
   ```
   guilds.members.read
   ```

### Step 6 — Configure Environment Variables

Copy `.env.example` to `.env` and fill in:

```env
VITE_SUPABASE_URL=https://ywopseozndeylhzzxzne.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_your-key-here
VITE_DISCORD_SERVER_ID=1432717420119720018
VITE_DISCORD_ADMIN_ROLE=Admiral
VITE_DISCORD_MEMBER_ROLE=Fidelis
```

### Step 7 — Test Locally

```bash
npm install
npm run dev
```

Visit `http://localhost:5173` — you should see the Discord login screen.

### Step 8 — Deploy to Netlify

1. Push project to GitHub
2. [netlify.com](https://netlify.com) → **Add new site → Import from GitHub**
3. Select your repo (build settings auto-detected from `netlify.toml`)
4. **Site configuration → Environment variables** — add all 5 variables from your `.env`
5. **Deploy site**

After deploy, go back to your Discord OAuth2 app and add your Netlify URL to the redirects:
```
https://your-site.netlify.app
```
And update Supabase → Authentication → URL Configuration → **Site URL** to your Netlify URL.

---

## How Role Checking Works

1. Member clicks **Login with Discord**
2. Discord OAuth grants the app an access token with `guilds.members.read` scope
3. App calls Discord API to fetch the member's roles in server `1432717420119720018`
4. If they have **Admiral** → admin access
5. If they have **Fidelis** → member access
6. Otherwise → access denied screen
7. Role is cached in Supabase for 5 minutes to avoid repeated API calls

---

## Project Structure

```
ymir-guild-tracker/
├── supabase/
│   └── schema.sql
├── src/
│   ├── lib/
│   │   ├── supabase.js       # Supabase client + Discord constants
│   │   └── discord.js        # Discord role fetching logic
│   ├── context/
│   │   ├── AuthContext.jsx   # Discord OAuth + role resolution
│   │   └── AppContext.jsx    # Guild data + DB operations
│   ├── hooks/
│   │   └── useRealtime.js
│   ├── components/
│   │   ├── Modal.jsx
│   │   └── AuctionTimer.jsx
│   ├── pages/
│   │   ├── Login.jsx         # Discord login screen
│   │   ├── AccessDenied.jsx  # Non-member screen
│   │   ├── Roster.jsx
│   │   ├── Events.jsx
│   │   ├── Auction.jsx
│   │   └── Admin.jsx         # Admiral only
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── .env.example
├── index.html
├── vite.config.js
├── netlify.toml
└── package.json
```
