# Mobile Development Tunnel Automation

**Automated Cloudflare tunnel setup for local iOS/Android development**

## 🎯 Purpose

This automation eliminates the manual process of:

1. Starting a Cloudflare tunnel
2. Copying the tunnel URL
3. Pasting it into Capacitor config files
4. Syncing the mobile project

Instead, **one command does it all**.

---

## 📋 Prerequisites

### Required Tools

```bash
# Install Cloudflare tunnel (cloudflared)
brew install cloudflare/cloudflare/cloudflared

# Install jq (for JSON manipulation)
brew install jq
```

### Verify Installation

```bash
cloudflared --version
jq --version
```

---

## 🚀 Quick Start

### Method 1: Full Automation (Recommended)

**Start tunnel + sync iOS + open Xcode:**

```bash
npm run tunnel:ios:open
```

This will:

1. ✅ Check if dev server is running (port 3000)
2. ✅ Start Cloudflare tunnel
3. ✅ Extract tunnel URL automatically
4. ✅ Update `ios/App/App/capacitor.config.json`
5. ✅ Sync iOS project with Capacitor
6. ✅ Open Xcode with your project
7. ✅ Keep tunnel running until you stop it

### Method 2: Manual Sync

**Start tunnel + sync iOS (don't open Xcode):**

```bash
npm run tunnel:ios
```

**Start tunnel only (manual sync):**

```bash
npm run tunnel:start
```

---

## 📝 Complete Workflow

### Step 1: Start Your Dev Server

In Terminal 1:

```bash
npm run dev
```

Keep this running!

### Step 2: Start the Tunnel

In Terminal 2:

```bash
npm run tunnel:ios:open
```

You'll see:

```
🌊 Quiver Mobile Dev Tunnel Automation
========================================

✅ Next.js dev server detected on port 3000

🔒 Starting Cloudflare Tunnel...

Tunnel PID: 12345
Waiting for tunnel URL...

✅ Tunnel URL extracted: https://abc-123.trycloudflare.com
✅ Tunnel URL saved to .tunnel-url
📱 Updating iOS Capacitor config...
✅ iOS config updated: ios/App/App/capacitor.config.json
🔄 Syncing iOS project...
✅ iOS sync complete
📱 Opening Xcode...

==================================
✅ Tunnel Setup Complete!
==================================

Tunnel URL: https://abc-123.trycloudflare.com

Your mobile app will now connect to your local dev server!
```

### Step 3: Run Your App in Xcode

1. Xcode will open automatically (if you used `tunnel:ios:open`)
2. Select your device/simulator
3. Press ▶️ Run
4. App loads from your local dev server via the tunnel

### Step 4: Develop with Hot Reload

- Make changes in your code
- Save files
- App updates automatically (Next.js hot reload)
- See changes instantly on your device/simulator

### Step 5: Stop the Tunnel

When done, press `Ctrl+C` in Terminal 2, or:

```bash
npm run tunnel:stop
```

---

## 🛠️ Available Commands

| Command                   | Description                           |
| ------------------------- | ------------------------------------- |
| `npm run tunnel:start`    | Start tunnel only, update config      |
| `npm run tunnel:ios`      | Start tunnel, update config, sync iOS |
| `npm run tunnel:ios:open` | Start tunnel, sync iOS, open Xcode    |
| `npm run tunnel:stop`     | Stop the tunnel and cleanup           |
| `npm run tunnel:status`   | Check tunnel status                   |

---

## 🔍 Tunnel Status

Check if tunnel is running and view current URL:

```bash
npm run tunnel:status
```

Output:

```
🌊 Cloudflare Tunnel Status
============================

✅ Tunnel is RUNNING
   PID: 12345
   URL: https://abc-123.trycloudflare.com

✅ Next.js dev server is running on port 3000

iOS Config URL: https://abc-123.trycloudflare.com
✅ Config matches active tunnel
```

---

## 📁 Files Modified by Automation

The tunnel automation manages these files:

1. **`ios/App/App/capacitor.config.json`**

   - Updates `server.url` field with new tunnel URL
   - Backed up automatically by git

2. **`.tunnel-url`** (git-ignored)

   - Stores current tunnel URL
   - Used for status checks
   - Auto-cleaned on stop

3. **`.tunnel-pid`** (git-ignored)
   - Stores tunnel process ID
   - Used for cleanup
   - Auto-removed on stop

---

## 🔒 Security Notes

### Tunnel URLs are Temporary

- New URL generated each time
- URLs expire when tunnel stops
- Never commit tunnel URLs to git

### Environment Variables (Optional)

If you want to manually set a tunnel URL:

```bash
export CAPACITOR_DEV_URL="https://your-tunnel.trycloudflare.com"
npm run mobile:sync:local
```

But with automation, you don't need this anymore!

---

## 🐛 Troubleshooting

### Error: "cloudflared is not installed"

**Solution:**

```bash
brew install cloudflare/cloudflare/cloudflared
```

### Error: "jq is not installed"

**Solution:**

```bash
brew install jq
```

### Error: "Next.js dev server is not running"

**Solution:**
Start dev server first:

```bash
npm run dev
```

Then run tunnel command.

### Error: "Failed to extract tunnel URL"

**Possible causes:**

1. Port 3000 is blocked
2. Cloudflare tunnel failed to start
3. Network issues

**Solution:**

```bash
# Check if dev server is running
lsof -i :3000

# Test cloudflared manually
cloudflared tunnel --url http://localhost:3000
```

### Tunnel URL Changed but App Still Uses Old URL

**Solution:**

```bash
# Stop old tunnel
npm run tunnel:stop

# Start new tunnel (updates config automatically)
npm run tunnel:ios:open
```

### Multiple Tunnel Processes Running

**Solution:**

```bash
# Stop all tunnels
npm run tunnel:stop

# Or manually
pkill -f "cloudflared tunnel"
```

---

## 💡 Tips & Best Practices

### 1. Use Two Terminal Windows

- **Terminal 1:** `npm run dev` (keep running)
- **Terminal 2:** `npm run tunnel:ios:open` (keep running)

### 2. Don't Commit Tunnel Files

The following are already in `.gitignore`:

- `.tunnel-url`
- `.tunnel-pid`
- `capacitor.config.dev.ts`

### 3. Restart Tunnel When Needed

If dev server restarts, restart the tunnel:

```bash
# In Terminal 2
Ctrl+C  # Stop tunnel
npm run tunnel:ios:open  # Start new tunnel
```

### 4. Check Status Before Debugging

If app won't load:

```bash
npm run tunnel:status
```

Verify:

- ✅ Tunnel is running
- ✅ Dev server is running
- ✅ Config matches tunnel URL

### 5. Use `tunnel:ios:open` for Speed

Fastest way to start iOS development:

```bash
# One command = tunnel + sync + xcode
npm run tunnel:ios:open
```

---

## 🔄 How It Works

### 1. Tunnel Start Process

```bash
npm run tunnel:ios:open
```

**What happens:**

1. **Check Dependencies**

   - Verifies `cloudflared` installed
   - Verifies `jq` installed
   - Checks dev server on port 3000

2. **Start Tunnel**

   - Runs `cloudflared tunnel --url http://localhost:3000`
   - Captures output to extract URL
   - Waits up to 30 seconds for URL

3. **Extract URL**

   - Parses tunnel output
   - Finds `https://...trycloudflare.com` URL
   - Saves to `.tunnel-url` file
   - Saves process ID to `.tunnel-pid`

4. **Update Config**

   - Uses `jq` to update JSON
   - Updates `ios/App/App/capacitor.config.json`
   - Sets `server.url` to tunnel URL

5. **Sync iOS** (if --sync-ios flag)

   - Runs `npx cap sync ios`
   - Updates native iOS project

6. **Open Xcode** (if --open-xcode flag)

   - Runs `npx cap open ios`
   - Opens workspace in Xcode

7. **Keep Running**
   - Displays tunnel URL
   - Shows logs
   - Waits for Ctrl+C

### 2. Cleanup Process

```bash
npm run tunnel:stop
# Or press Ctrl+C
```

**What happens:**

1. **Kill Tunnel Process**

   - Reads PID from `.tunnel-pid`
   - Sends SIGTERM to process
   - Removes `.tunnel-pid` file

2. **Cleanup Remaining Processes**

   - Searches for orphaned `cloudflared` processes
   - Kills any found

3. **Remove Temp Files**
   - Deletes `.tunnel-url`
   - Removes `.tunnel-pid`

---

## 🎨 Customization

### Add Android Support

Edit `scripts/dev-tunnel.sh`, add after iOS config update:

```bash
# Update Android Capacitor config
ANDROID_CONFIG="android/app/src/main/assets/capacitor.config.json"
if [[ -f "$ANDROID_CONFIG" ]]; then
    echo ""
    echo -e "${BLUE}🤖 Updating Android Capacitor config...${NC}"

    TMP_FILE=$(mktemp)
    jq --arg url "$TUNNEL_URL" '.server.url = $url' "$ANDROID_CONFIG" > "$TMP_FILE"
    mv "$TMP_FILE" "$ANDROID_CONFIG"

    echo -e "${GREEN}✅ Android config updated: ${ANDROID_CONFIG}${NC}"
fi
```

### Use Different Port

If dev server runs on different port:

```bash
# Edit scripts/dev-tunnel.sh
# Change:
cloudflared tunnel --url http://localhost:3000
# To:
cloudflared tunnel --url http://localhost:YOUR_PORT
```

### Use ngrok Instead

Install ngrok:

```bash
brew install ngrok
```

Edit `scripts/dev-tunnel.sh`:

```bash
# Replace cloudflared command with:
ngrok http 3000
```

Update URL extraction logic to match ngrok output format.

---

## 📚 Related Documentation

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Cloudflare Tunnel Documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [iOS App Release Steps](./IOS_APP_RELEASE_STEPS.md)
- [Architecture Documentation](../ARCHITECTURE.md)

---

## 🆘 Support

### Issues with Tunnel Automation

1. Check status: `npm run tunnel:status`
2. View logs: Check terminal output
3. Clean restart:
   ```bash
   npm run tunnel:stop
   npm run tunnel:ios:open
   ```

### Still Having Issues?

Check these files:

- `scripts/dev-tunnel.sh` - Main automation script
- `scripts/tunnel-stop.sh` - Cleanup script
- `scripts/tunnel-status.sh` - Status checker

---

**Last Updated:** October 2024  
**Version:** 1.0.0  
**Status:** Production Ready ✅


