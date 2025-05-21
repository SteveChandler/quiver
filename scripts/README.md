# Database Scripts

This folder contains SQL scripts for setting up and modifying the database schema.

## Running the Scripts

You can run these scripts in your Supabase SQL Editor:

1. Log in to your Supabase dashboard
2. Go to the SQL Editor section
3. Create a new query
4. Copy and paste the contents of the script you want to run
5. Click "Run" to execute the SQL

## Available Scripts

- `create_session_tables.sql` - Creates the initial tables for beaches, boards, sessions, and session media
- `update_session_policy.sql` - Updates the Row Level Security policy on the sessions table to make sessions viewable by all users (for the community feature)

## Update Session Policies

To enable the community feature where all users (including unauthenticated visitors) can see sessions, you need to run the `update_session_policy.sql` script.

This script:

1. Drops the existing policy that restricts session viewing to the session owner
2. Creates a new policy that allows anyone to view all sessions
3. Maintains the existing policies for insert, update, and delete operations (users can still only modify their own sessions)

After running this script, sessions will be visible on the Community tab of the home screen to anyone visiting the site.
