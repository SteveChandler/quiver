# 🚀 Mobile Dev Tunnel - Quick Start

**One-command iOS development with local hot reload**

---

## ⚡ Quick Commands

```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Start tunnel + sync + open Xcode
npm run tunnel:ios:open
```

**That's it!** Your iOS app now connects to your local dev server.

---

## 📋 All Commands

| Command                   | What It Does                                           |
| ------------------------- | ------------------------------------------------------ |
| `npm run tunnel:ios:open` | Start tunnel → sync iOS → open Xcode (full automation) |
| `npm run tunnel:ios`      | Start tunnel → sync iOS (no Xcode)                     |
| `npm run tunnel:start`    | Start tunnel only (manual sync)                        |
| `npm run tunnel:stop`     | Stop tunnel and cleanup                                |
| `npm run tunnel:status`   | Check if tunnel is running                             |

---

## 🛠️ First Time Setup

### 1. Install Dependencies

```bash
# Install cloudflared
brew install cloudflare/cloudflare/cloudflared

# Install jq (JSON processor)
brew install jq
```

### 2. Verify Installation

```bash
cloudflared --version
jq --version
```

### 3. You're Ready!

```bash
npm run dev                # Terminal 1
npm run tunnel:ios:open    # Terminal 2
```

---

## 🔍 Check Status

```bash
npm run tunnel:status
```

Output:

```
✅ Tunnel is RUNNING
   URL: https://abc-123.trycloudflare.com
✅ Next.js dev server is running
✅ Config matches active tunnel
```

---

## 🐛 Troubleshooting

### Problem: "cloudflared is not installed"

```bash
brew install cloudflare/cloudflare/cloudflared
```

### Problem: "jq is not installed"

```bash
brew install jq
```

### Problem: "dev server is not running"

Start dev server first:

```bash
npm run dev
```

### Problem: App won't load

1. Check status: `npm run tunnel:status`
2. Restart tunnel: `Ctrl+C` then `npm run tunnel:ios:open`
3. Check dev server is running: `npm run dev`

---

## 📚 Full Documentation

See [docs/MOBILE_DEV_TUNNEL.md](./docs/MOBILE_DEV_TUNNEL.md) for:

- Complete workflow
- Advanced customization
- Android support
- Troubleshooting guide

---

## 💡 Pro Tips

1. **Keep two terminals open:**

   - Terminal 1: `npm run dev` (always running)
   - Terminal 2: `npm run tunnel:ios:open` (start when needed)

2. **Check status first:**

   ```bash
   npm run tunnel:status
   ```

3. **Stop cleanly:**

   - Press `Ctrl+C` in tunnel terminal
   - Or run `npm run tunnel:stop`

4. **One command to rule them all:**
   ```bash
   npm run tunnel:ios:open
   ```
   This does everything: tunnel → sync → Xcode → ready to develop!

---

**Updated:** October 2024 | **Status:** ✅ Production Ready


