Craft and queue a Bluesky post for @quiversurf.app.

## Input

The user provides a raw idea or topic after `/post`: #$ARGUMENTS

If no arguments provided, ask what they want to post about.

## Flow

### Step 1: Polish the text

Rewrite the input as a casual, first-person dev note from an indie surf app developer.

Rules:
- Under 280 characters (leave room for the URL line)
- Tone: chill, authentic, no hype. Like texting a surf friend about what you built.
- No hashtags
- No emojis unless they fit completely naturally
- Vary the opener — don't always start the same way
- Always end with a blank line then `quiversurf.app` on its own line
- lowercase feel — no title case, no ALL CAPS

Present 2-3 options for the user to pick from.

### Step 2: User picks or edits

Wait for the user to choose an option, edit one, or provide their own version.

### Step 3: Queue it

Run this command with the final approved text:

```bash
node scripts/dev-note.mjs "<final text here>"
```

Confirm the queue insertion was successful and show the row ID.

### Step 4: Offer to post now

Ask if they want to trigger the post immediately or let it go out on the next cron run. If immediate:

```bash
curl -s -X POST "https://vawdnbbgawichorsjiwe.supabase.co/functions/v1/bluesky-auto-post" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"post_type": "dev_notes"}'
```

Read `SUPABASE_SERVICE_ROLE_KEY` from `.env.local` before running the curl command.

Show the Bluesky post URI on success.
