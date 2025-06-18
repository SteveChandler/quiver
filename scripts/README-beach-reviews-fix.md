# Beach Reviews Database Fix

## Problem

The beach reviews feature is failing with the error:

```
"Could not find a relationship between 'beach_reviews' and 'profiles' in the schema cache"
```

This happens because the `beach_reviews` table references `auth.users` directly, but the application code expects to join with a `profiles` table.

## Solution

Run the SQL script in `manual-beach-reviews-fix.sql` to fix the database schema.

## How to Apply the Fix

1. **Open Supabase Dashboard**

   - Go to your Supabase project dashboard
   - Navigate to the SQL Editor

2. **Execute the Migration**

   - Copy the entire contents of `scripts/manual-beach-reviews-fix.sql`
   - Paste it into the SQL Editor
   - Click "Run" to execute the script

3. **Verify the Fix**
   - The script will create a `profiles` table if it doesn't exist
   - It will populate the `profiles` table with data from existing `auth.users`
   - It will update the foreign key constraint in `beach_reviews` to reference `profiles`
   - All existing users will have profile records created automatically

## What the Fix Does

1. **Creates `profiles` table** with proper relationship to `auth.users`
2. **Migrates existing user data** from `auth.users` to `profiles`
3. **Updates foreign key** in `beach_reviews` to reference `profiles` instead of `auth.users`
4. **Sets up proper RLS policies** for the `profiles` table
5. **Creates necessary indexes** for optimal performance

## After Applying the Fix

Once you run the SQL script:

- ✅ Beach review submissions will work
- ✅ Beach review dialog will close properly after submission
- ✅ User information will display correctly in reviews
- ✅ All existing users will have profile records

## Test the Fix

1. Navigate to a beach page in your app
2. Click "Write Review"
3. Fill out and submit a review
4. The dialog should close and the review should appear

The console errors should be resolved and the feature should work normally.
