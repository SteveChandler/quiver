# 🐍 Liquid Snake User Setup Script

This script creates a complete test user profile for "Liquid Snake" with realistic dummy data for your surf app.

## 📋 What This Script Creates

### 👤 User Profile

- **Name**: Liquid Snake
- **Email**: liquid.snake@foxhound.mil
- **Bio**: Former FOXHOUND operative turned surfer with Metal Gear themed personality
- **Location**: Shadow Moses Island → Pacific Beach, CA
- **Experience Level**: Expert
- **Social Stats**: 42 followers, 33 following

### 🏄‍♂️ Surfboard

- **Name**: Metal Gear REX (Custom Shortboard by Custom Shaper)
- **Description**: Military-grade construction with stealth capabilities
- **Note**: Minimal setup due to database schema limitations

### 🏖️ Beach Reviews (4 beaches)

1. **Pacific Beach** - 5/5 stars - "Perfect training ground for tactical water operations"
2. **Ocean Beach** - 4/5 stars - "Solid Snake would hate the crowds here"
3. **Mission Beach** - 3/5 stars - "Too much like a theme park for my taste"
4. **La Jolla Shores** - 2/5 stars - "Too gentle for advanced tactical training"

### 🏄‍♂️ Surf Sessions (10 sessions)

- All sessions at Pacific Beach before today
- Dates spread over the past 30+ days
- Realistic wave conditions (2-6 ft)
- Tactical/military themed session notes
- Duration: 90-150 minutes each
- Various ratings and conditions

### 📱 User Activities

- Session completion activities
- Beach review activities
- Ready for social feed integration

## 🚀 How to Run the Script

You have **two script options** depending on your preference:

### Option A: Complete Script (Includes Auth User Creation)

**File**: `scripts/create-liquid-snake-user.sql`

This script creates everything including the auth user. It also fixes the `handle_new_user` trigger function if it's causing conflicts.

1. Open your Supabase project dashboard
2. Go to the SQL Editor
3. Copy and paste the entire `create-liquid-snake-user.sql` script
4. Click "Run" to execute

### Option B: Profile Only Script (Safer Alternative) ⭐ **RECOMMENDED**

**File**: `scripts/create-liquid-snake-profile-only.sql`

This is the safer approach:

1. **First**: Create the auth user via Supabase Auth Dashboard:

   - Go to Authentication > Users in your Supabase dashboard
   - Click "Add user"
   - Email: `liquid.snake@foxhound.mil`
   - Password: `MetalGear2024!`
   - Copy the generated User ID

2. **Then**: Update the script:

   - Open `scripts/create-liquid-snake-profile-only.sql`
   - Replace `liquid_snake_id UUID := '11111111-1111-1111-1111-111111111111'::UUID;`
   - With the actual UUID from step 1

3. **Finally**: Run the script in SQL Editor

### Command Line Options

```bash
# Complete script
psql -h your-db-host -U your-username -d your-database -f scripts/create-liquid-snake-user.sql

# Profile only script
psql -h your-db-host -U your-username -d your-database -f scripts/create-liquid-snake-profile-only.sql
```

## ⚠️ Important Notes

### Trigger Function Fix

If you encounter errors about `username` column not existing, the complete script (Option A) automatically fixes the `handle_new_user()` trigger function to match your current schema.

### Which Option to Choose?

- **Use Option B (Profile Only)** if you want the safest approach
- **Use Option A (Complete)** if you want everything automated (includes trigger fix)

### UUID Consistency

The script uses a fixed UUID (`11111111-1111-1111-1111-111111111111`) for consistency. This allows:

- Predictable user ID for testing
- Easy cleanup if needed
- Repeatable test scenarios

### Conflict Handling

The script uses `ON CONFLICT` clauses to handle:

- Re-running the script multiple times
- Existing data conflicts
- Safe updates when needed

## 🧪 Verification

After running the script, you'll see verification queries that show:

- User profile details
- Surfboard information
- Beach reviews summary
- Surf sessions overview

## 🔄 Script Re-execution

The script is designed to be safely re-run multiple times:

- Uses `ON CONFLICT DO NOTHING` for most insertions
- Updates existing profile data where appropriate
- Won't create duplicate data

## 🗑️ Cleanup (Optional)

If you need to remove Liquid Snake later:

```sql
-- Remove all data for Liquid Snake
DELETE FROM user_activities WHERE user_id = '11111111-1111-1111-1111-111111111111';
DELETE FROM sessions WHERE user_id = '11111111-1111-1111-1111-111111111111';
DELETE FROM beach_reviews WHERE user_id = '11111111-1111-1111-1111-111111111111';
DELETE FROM boards WHERE user_id = '11111111-1111-1111-1111-111111111111';
DELETE FROM profiles WHERE id = '11111111-1111-1111-1111-111111111111';
DELETE FROM auth.users WHERE id = '11111111-1111-1111-1111-111111111111';
```

## 🎯 Use Cases

This dummy user is perfect for:

- **Testing social features** (follow/unfollow, activity feeds)
- **Demo presentations** (realistic data with personality)
- **Development testing** (consistent test user)
- **UI/UX validation** (full profile with content)
- **Beach review system testing** (multiple reviews across beaches)
- **Session logging validation** (historical session data)

## 🏄‍♂️ Character Background

Liquid Snake brings Metal Gear Solid personality to your surf app:

- Military precision meets surf culture
- Tactical approach to wave riding
- Competitive spirit with his twin Solid Snake
- Philosophical about freedom and ocean connection

Perfect for adding some character to your test environment! 🌊🏄‍♂️🐍
