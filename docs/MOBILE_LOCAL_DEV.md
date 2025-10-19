# Mobile Local Development with Secure Tunnels

This guide explains how to develop the Quiver mobile app using your local Next.js server instead of the Vercel deployment.

## 🎯 Benefits

- **No Vercel Protection Bypass** - Completely bypass Vercel's protection mechanisms
- **Instant Updates** - See local code changes immediately in the mobile app
- **Full Dev Environment** - Access to all your local environment variables
- **Better Debugging** - Full access to server logs and debugging tools
- **No Deploy Delays** - Test immediately without waiting for Vercel deployments

## 🚀 Quick Start

### ⚡ Fully Automated Setup (Recommended)

**One command to start everything:**

```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Start tunnel, sync iOS, open Xcode (all automatic!)
npm run tunnel:ios:open
```

**That's it!** The automation:

- ✅ Starts Cloudflare tunnel
- ✅ Extracts tunnel URL automatically
- ✅ Updates iOS Capacitor config (no manual copy-paste!)
- ✅ Syncs iOS project
- ✅ Opens Xcode
- ✅ Keeps running until you stop it (Ctrl+C)

**Full documentation:** See [MOBILE_DEV_TUNNEL.md](./MOBILE_DEV_TUNNEL.md) for complete guide.

**Quick reference:** See [../TUNNEL_QUICK_START.md](../TUNNEL_QUICK_START.md) for command cheat sheet.

### 📋 Available Commands

| Command                   | What It Does                                           |
| ------------------------- | ------------------------------------------------------ |
| `npm run tunnel:ios:open` | Start tunnel → sync iOS → open Xcode (full automation) |
| `npm run tunnel:ios`      | Start tunnel → sync iOS (no Xcode)                     |
| `npm run tunnel:start`    | Start tunnel only (manual sync)                        |
| `npm run tunnel:stop`     | Stop tunnel and cleanup                                |
| `npm run tunnel:status`   | Check if tunnel is running                             |

### 🛠️ First Time Only: Install Dependencies

```bash
# Install cloudflared (tunnel)
brew install cloudflare/cloudflare/cloudflared

# Install jq (JSON processor for auto-config updates)
brew install jq
```

### Option B: Manual Setup (Fallback)

### 1. Start Your Local Dev Server

```bash
npm run dev
```

This starts Next.js on `http://localhost:3000`

### 2. Expose with a Secure Tunnel

Choose one of these options:

#### Option A: Cloudflare Tunnel (Recommended)

**Installation:**

```bash
# macOS
brew install cloudflare/cloudflare/cloudflared

# Windows (with Scoop)
scoop install cloudflared

# Linux
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
```

**Run:**

```bash
cloudflared tunnel --url http://localhost:3000
```

**Output Example:**

```
2025-01-16T12:00:00Z INF +--------------------------------------------------------------------------------------------+
2025-01-16T12:00:00Z INF |  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |
2025-01-16T12:00:00Z INF |  https://abc-123-xyz.trycloudflare.com                                                     |
2025-01-16T12:00:00Z INF +--------------------------------------------------------------------------------------------+
```

**Pros:**

- Free, no account required
- Fast and reliable
- Automatic HTTPS
- No bandwidth limits

**Cons:**

- URL changes each time you run it
- Random subdomain (not customizable)

#### Option B: ngrok

**Installation:**

```bash
# macOS
brew install ngrok

# Or download from https://ngrok.com/download
```

**Setup (one-time):**

```bash
# Sign up at https://ngrok.com and get your auth token
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

**Run:**

```bash
ngrok http 3000
```

**Output Example:**

```
Session Status                online
Account                       Your Name (Plan: Free)
Forwarding                    https://abc123xyz.ngrok-free.app -> http://localhost:3000
```

**Pros:**

- Persistent subdomain (with paid plan)
- Nice web interface at http://localhost:4040
- Request inspection and replay

**Cons:**

- Requires account/auth token
- Free tier shows interstitial page (can skip)
- Rate limits on free tier

### 3. Configure Capacitor

Create a **local copy** of `capacitor.config.dev.ts` (it's gitignored):

```bash
cp capacitor.config.dev.ts capacitor.config.dev.ts
```

Edit it and replace `YOUR-TUNNEL-URL-HERE` with your tunnel URL:

```typescript
const config: CapacitorConfig = {
  // ... other config
  server: {
    androidScheme: "https",
    url: "https://abc-123-xyz.trycloudflare.com", // Your tunnel URL
    cleartext: false,
    allowNavigation: ["*"],
  },
};
```

**Alternative:** Set as environment variable:

```bash
export CAPACITOR_DEV_URL='https://abc-123-xyz.trycloudflare.com'
npm run mobile:sync:local
```

### 4. Sync and Run

```bash
# Sync with your local tunnel config
npm run mobile:sync:local

# Or sync and open Android Studio directly
npm run mobile:build:android:local
```

Then run the app in Android Studio or Xcode.

## 📱 Workflow

### Daily Development Flow (Automated)

1. **Terminal 1:** Start Next.js

   ```bash
   npm run dev
   ```

2. **Terminal 2:** Start automated tunnel

   ```bash
   npm run tunnel:ios:open
   ```

3. **Develop!** Changes hot reload automatically! 🎉

4. **When done:** Press `Ctrl+C` in Terminal 2 to stop tunnel

### Daily Development Flow (Manual - if you prefer)

1. **Terminal 1:** Start Next.js

   ```bash
   npm run dev
   ```

2. **Terminal 2:** Start tunnel

   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```

3. **Update tunnel URL** in `ios/App/App/capacitor.config.json` (if URL changed)

4. **Sync once** (or whenever you change Capacitor config)

   ```bash
   npx cap sync ios
   ```

5. **Run in emulator/device** - changes hot reload automatically! 🎉

### Switching Between Environments

**Local Development (with tunnel):**

```bash
npm run mobile:sync:local
```

**Vercel Dev:**

```bash
npm run mobile:sync:dev
```

**Production:**

```bash
npm run mobile:sync
```

## 🔧 Troubleshooting

### Tunnel URL Changes Every Time

**Cloudflare:** URL changes on each run. Update `capacitor.config.dev.ts` or use env var.

**ngrok:** Upgrade to paid plan for persistent subdomain, or use env var:

```bash
# Add to your shell profile (~/.zshrc or ~/.bashrc)
export CAPACITOR_DEV_URL='YOUR-NGROK-URL'
```

### Can't Connect from Mobile Device

1. **Check tunnel is running** - You should see logs
2. **Verify HTTPS URL** - Must be `https://`, not `http://`
3. **Test in browser** - Open tunnel URL in desktop browser first
4. **Check Next.js** - Ensure `npm run dev` is running
5. **Restart app** - Close and reopen the mobile app

### Changes Not Reflecting

1. **Hard refresh** - Close and reopen the mobile app
2. **Clear app data** - In device settings
3. **Re-sync** - Run `npm run mobile:sync:local` again
4. **Check tunnel logs** - Ensure requests are hitting the tunnel

### Environment Variables

Local `.env.local` variables are automatically used! Make sure you have:

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
# ... etc
```

### Cloudflare Tunnel "Too Many Connections"

Free tier occasionally hits limits. Solutions:

- Restart the tunnel
- Wait a few minutes
- Try ngrok instead

## 💡 Pro Tips

1. **Use automation** - `npm run tunnel:ios:open` does everything in one command
2. **Check status anytime** - `npm run tunnel:status` shows current tunnel state
3. **Keep two terminals open** - Terminal 1 for `npm run dev`, Terminal 2 for tunnel
4. **Stop cleanly** - Press `Ctrl+C` or run `npm run tunnel:stop`
5. **Test on real device** - Works the same as emulator
6. **Multiple developers** - Each person needs their own tunnel
7. **Troubleshooting** - See [MOBILE_DEV_TUNNEL.md](./MOBILE_DEV_TUNNEL.md) for detailed troubleshooting

## 📊 Performance Comparison

| Method                    | Setup Time | Reload Speed | Debugging | Manual Steps |
| ------------------------- | ---------- | ------------ | --------- | ------------ |
| **Vercel Deploy**         | 5-10 min   | 2-5 min      | Limited   | Many         |
| **Vercel Preview**        | 1-2 min    | 1-2 min      | Limited   | Some         |
| **Local Tunnel (Manual)** | 2-3 min    | Instant      | Full      | 5 steps      |
| **Local Tunnel (Auto)**   | 30 sec     | Instant      | Full      | 1 command ✅ |

## 🔒 Security Notes

- Tunnel URLs are temporary and public
- Don't share tunnel URLs (they expose your local dev server)
- Stop tunnels when not developing
- Never commit tunnel URLs to git (already in `.gitignore`)
- Use authentication in your dev environment

## 📚 References

- **[MOBILE_DEV_TUNNEL.md](./MOBILE_DEV_TUNNEL.md)** - Complete automation documentation
- **[../TUNNEL_QUICK_START.md](../TUNNEL_QUICK_START.md)** - Quick reference card
- [Cloudflare Tunnel Docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/tunnel-guide/)
- [ngrok Documentation](https://ngrok.com/docs)
- [Capacitor Live Reload Guide](https://capacitorjs.com/docs/guides/live-reload)

---

**Last Updated:** October 2024  
**Tested On:** macOS Sonoma, iOS Simulator, Physical iOS Device  
**Status:** ✅ Fully Automated
