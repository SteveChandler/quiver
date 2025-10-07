# Beach Intel Quick Setup Guide

## ✅ What's Been Built

The multi-beach daily intel system is now complete and ready to use! Here's what was implemented:

### **Backend (Complete)**
- ✅ Database table: `beach_daily_intel`
- ✅ Intel generation service (reusable logic)
- ✅ Batch generation script for top 10 beaches
- ✅ GitHub Actions workflow (3x daily)

### **Frontend (Complete)**
- ✅ BestSurfWindow component
- ✅ Updated Today tab with intel widget
- ✅ Collapsible detailed forecasts

---

## 🚀 Setup Steps (5 minutes)

### **Step 1: Run the Database Migration**

The migration is already created at:
`supabase/migrations/20251007000000_create_beach_daily_intel.sql`

**Option A: Via Supabase Dashboard**
1. Go to Supabase Dashboard → SQL Editor
2. Open a new query
3. Copy/paste the entire migration file
4. Click "Run"

**Option B: Via CLI** (if you have Supabase CLI set up)
```bash
supabase db push
```

**Verify it worked:**
```sql
-- Should return the new table
SELECT * FROM beach_daily_intel LIMIT 1;
```

---

### **Step 2: Test Intel Generation Locally** (Optional but recommended)

```bash
# Make sure you have these in .env.local
export SUPABASE_URL="your-supabase-url"
export SUPABASE_SERVICE_ROLE_KEY="your-service-key"

# Run the generation script
npm run generate-daily-intel
```

**Expected output:**
```
🌊 Beach Intel Generation
📅 2025-10-07T...
⏰ Generation window: 06:00
──────────────────────────────────────────────────────────────
Generating intel for 10 beaches...

✅ [1/10] 65d177de-e75a-4ad8-aa0d-48a67c0851b0 - Success (Ocean Beach Pier)
✅ [2/10] 91df193c-f2c8-4e6c-984e-b859bd741061 - Success (Tourmaline Surf Park)
...
🎉 Generation complete in 8.53s
   Success: 10
   Failed: 0
```

---

### **Step 3: GitHub Secrets (Already Set)**

The workflow uses existing secrets:
- ✅ `SUPABASE_URL` (already configured)
- ✅ `SUPABASE_SERVICE_ROLE_KEY` (already configured)

No new secrets needed! 🎉

---

### **Step 4: Enable Workflow**

The workflow is already committed and will run automatically:

**Schedule:**
- 6:00 AM PT (morning conditions)
- 10:00 AM PT (mid-morning update)
- 2:00 PM PT (afternoon update)

**Test it manually:**
1. Go to GitHub → Actions → "Generate Beach Intel (3x Daily)"
2. Click "Run workflow"
3. Click green "Run workflow" button
4. Wait ~30 seconds
5. Check logs for success

---

### **Step 5: View Results**

After the workflow runs successfully:

1. **Check Database:**
```sql
SELECT 
  beach_id,
  generation_time,
  best_window_start,
  best_window_end,
  surf_min_ft,
  surf_max_ft,
  wind_quality,
  confidence,
  generated_at
FROM beach_daily_intel
ORDER BY generated_at DESC
LIMIT 10;
```

2. **View in App:**
- Navigate to any of the top 10 beaches
- Click "Today" tab
- See "Best Time to Surf Today" widget! 🌊

---

## 🏖️ Top 10 Beaches Configured

1. **Ocean Beach Pier** - Intermediate (already generating morning intel posts)
2. **Tourmaline Surf Park** - Beginner, longboard haven
3. **Crystal Pier** - Beginner, Pacific Beach icon
4. **Mission Beach (Central)** - Beginner, high traffic
5. **PB Point** - Intermediate, classic point break
6. **Scripps** - Intermediate, La Jolla Shores
7. **Ocean Beach** - Intermediate, north of pier
8. **Birdrock** - Advanced, La Jolla reef
9. **Sunset Cliffs (Garbage)** - Advanced, legendary spot
10. **Horseshoe** - Advanced, La Jolla reef

---

## 🎯 What Happens Now

### **Automatic (No Action Required)**
- Workflow runs 3x daily at scheduled times
- Generates intel for all 10 beaches
- Stores in database
- Users see instant intel when visiting beaches

### **User Experience**
When users visit any top 10 beach:
1. Click "Today" tab
2. See "Best Time to Surf Today" widget
3. Get instant recommendations (no loading)
4. Can expand to see detailed forecast table

---

## 🔧 Troubleshooting

### **Migration Failed?**

**Error: "syntax error near ||"**
- Fixed in commit dbd09ee
- Re-run the migration

**Error: "table already exists"**
- Good! Migration already ran
- Skip to Step 2

### **Generation Script Fails?**

**Error: "Missing SUPABASE_URL"**
- Add to `.env.local` or GitHub Secrets

**Error: "Bot user not found"**
- Some beaches might not have complete data
- Script will skip them automatically

**Error: "No forecast data"**
- Make sure forecasts are being generated for these beaches
- Run `npm run forecast:update` first

### **No Intel Showing in App?**

**Check if data exists:**
```sql
SELECT COUNT(*) FROM beach_daily_intel;
```

**If 0 rows:**
- Run `npm run generate-daily-intel` locally
- Or trigger GitHub workflow manually

**If data exists but not showing:**
- Check browser console for errors
- Verify beach ID matches one of the top 10
- Check RLS policies are enabled

---

## 📊 Monitoring

### **GitHub Actions**
- Go to Actions → "Generate Beach Intel (3x Daily)"
- View run history and logs
- Set up email notifications for failures

### **Database Health**
```sql
-- Check latest generation
SELECT 
  COUNT(*) as total,
  MAX(generated_at) as last_generated,
  COUNT(DISTINCT beach_id) as unique_beaches
FROM beach_daily_intel
WHERE forecast_date = CURRENT_DATE;
```

### **Expected Results**
- Should have 30 rows daily (10 beaches × 3 generations)
- Last generated should be recent (< 4 hours)
- 10 unique beaches

---

## 🚀 Future Enhancements

**After Launch:**
1. Add share to social media
2. Push notifications for optimal windows
3. Expand to top 20-50 beaches
4. Add historical accuracy tracking
5. Personalized recommendations by skill level

---

## 📝 Quick Command Reference

```bash
# Generate intel locally
npm run generate-daily-intel

# Check morning intel (Ocean Beach only)
npm run morning-intel

# Build and test
npm run build
npm run dev

# Check database
# (run SQL queries in Supabase SQL Editor)
```

---

**Status:** ✅ Ready to deploy  
**Next Step:** Run migration in Supabase, then test workflow  
**Auto-deploys:** 6am, 10am, 2pm PT daily


