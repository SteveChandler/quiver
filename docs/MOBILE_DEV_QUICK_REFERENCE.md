# Mobile Development Quick Reference 🏄‍♂️

## Local Development with Tunnel (Bypass Vercel)

### ⚡ Quick Start

```bash
# 1. Start dev server + tunnel (one command!)
npm run mobile:dev:tunnel

# 2. Copy the tunnel URL from output, then either:
#    A) Update capacitor.config.dev.ts with URL, OR
#    B) Set env var: export CAPACITOR_DEV_URL='https://...'

# 3. Sync once
npm run mobile:sync:local

# 4. Open and run in Android Studio
npm run mobile:build:android:local
```

### 📋 Common Commands

```bash
# Mobile Development
npm run mobile:dev:tunnel          # Start dev + tunnel (auto)
npm run mobile:sync:local           # Sync with local tunnel config
npm run mobile:build:android:local  # Sync & open Android Studio

# Standard Mobile Commands
npm run mobile:sync                 # Production sync
npm run mobile:sync:dev             # Vercel dev sync
npm run mobile:build:android        # Production Android
npm run mobile:build:ios            # Production iOS
```

### 🛠 Setup (First Time Only)

1. **Install tunnel tool (choose one):**

   ```bash
   # Cloudflare (recommended)
   brew install cloudflare/cloudflare/cloudflared

   # OR ngrok
   brew install ngrok
   ngrok config add-authtoken YOUR_TOKEN
   ```

2. **Create local config:**
   ```bash
   cp capacitor.config.dev.example.ts capacitor.config.dev.ts
   # Edit capacitor.config.dev.ts and add your tunnel URL
   ```

### 🔄 Daily Workflow

```bash
# Terminal 1: Dev server + tunnel
npm run mobile:dev:tunnel

# Terminal 2: First time each day
export CAPACITOR_DEV_URL='https://YOUR-URL-FROM-TERMINAL-1'
npm run mobile:sync:local

# Run in Android Studio - hot reload works! ✨
```

### 🌐 Tunnel URLs

**Cloudflare:**

```bash
cloudflared tunnel --url http://localhost:3000
# Output: https://abc-123-xyz.trycloudflare.com
```

**ngrok:**

```bash
ngrok http 3000
# Output: https://abc123xyz.ngrok-free.app
```

### 🔧 Troubleshooting

| Problem                | Solution                                                            |
| ---------------------- | ------------------------------------------------------------------- |
| Tunnel URL changes     | Update `capacitor.config.dev.ts` or use `CAPACITOR_DEV_URL` env var |
| Changes not reflecting | Close/reopen app, or re-run `npm run mobile:sync:local`             |
| Can't connect          | Check tunnel is running, verify HTTPS URL, restart app              |
| Build errors           | Run `npm run mobile:sync` (production config) to verify             |

### 📚 Full Documentation

See [docs/MOBILE_LOCAL_DEV.md](./MOBILE_LOCAL_DEV.md) for:

- Detailed setup instructions
- Tunnel comparison (Cloudflare vs ngrok)
- Advanced workflows
- Environment variables
- Security notes

---

**Benefits:** Instant hot reload • No Vercel bypass needed • Full dev environment • Better debugging

**Last Updated:** January 2025
