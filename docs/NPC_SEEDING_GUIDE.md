# NPC Reviews and Intel Seeding Guide

This document explains how to use the NPC seeding script to populate Quiver with realistic community content from mock users.

## Overview

The `seed-npc-reviews-and-intel.ts` script creates authentic-feeling beach reviews and intel posts from mock users (NPCs) to make the community features feel lively and engaging.

## Prerequisites

1. **Mock Users**: Ensure you have mock users in the `profiles` table with `is_mock=true`
2. **Beaches**: Your `beaches` table should be populated with beach data
3. **Environment Variables**: Set up the required environment variables

## Environment Variables

### Required Variables

```bash
# Supabase connection
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Safety confirmations
CONFIRM_TARGET=DEV  # or "PROD" for production
RATING_COLS=overall_rating,wave_quality_rating,crowd_density_rating,parking_rating,accessibility_rating

# Production safety (required for PROD)
CONFIRM_PROD=YES  # Only required when CONFIRM_TARGET=PROD
```

### Optional Variables

```bash
# Clear existing NPC content before seeding
RESEED=1
```

## Usage Examples

### Development Seeding

For development environments, use the pre-configured npm script:

```bash
# Basic development seeding
npm run seed:npc-content:dev

# Development seeding with cleanup
RESEED=1 npm run seed:npc-content:dev
```

### Production Seeding

Production seeding requires additional confirmation:

```bash
# Production seeding (requires CONFIRM_PROD=YES)
CONFIRM_PROD=YES npm run seed:npc-content:prod

# Production seeding with cleanup
CONFIRM_PROD=YES RESEED=1 npm run seed:npc-content:prod
```

### Custom Configuration

For custom setups, you can run the script directly with your own environment variables:

```bash
# Custom rating columns
CONFIRM_TARGET=DEV \
RATING_COLS=quality,crowds,parking,access,overall \
SUPABASE_URL=your-url \
SUPABASE_SERVICE_ROLE_KEY=your-key \
TS_NODE_TRANSPILE_ONLY=1 ts-node scripts/seed-npc-reviews-and-intel.ts
```

## What Gets Created

### Beach Reviews
- **Quantity**: 1-3 reviews per beach from random NPCs
- **Content**: Personality-driven reviews reflecting each NPC's writing style
- **Ratings**: All 5 rating columns populated (3-5 star range, NPCs are generally positive)
- **Timing**: Reviews backdated within the last 3 weeks

### Intel Posts
- **Quantity**: 1-3 intel posts per beach from random NPCs
- **Types**: conditions, parking, crowd, hazards, access
- **Location**: Beach coordinates with slight random offset (±0.001 degrees)
- **Surf Data**: Conditions posts include detailed surf conditions JSON
- **Timing**: Posts backdated within the last 10 days

## NPC Personalities and Writing Styles

The script creates content based on different NPC personalities:

### Rookie Riley
- **Style**: Enthusiastic and grateful
- **Content**: Learning experiences, first-time stoke, community appreciation
- **Example**: "OMG! Had the most amazing time at Cowell Beach! This place is perfect for beginners..."

### Local Larry
- **Style**: Knowledgeable and helpful
- **Content**: Condition updates, crowd reports, pro tips
- **Example**: "Heads up everyone - Steamer Lane has consistent 3-4ft waves with light offshore winds..."

### Travel Tina
- **Style**: Comparative and adventurous
- **Content**: Beach comparisons, travel insights, discoveries
- **Example**: "Finally made it to Mavericks after hearing so much about it! Reminds me of Pipeline but colder..."

### Photo Paul
- **Style**: Aesthetic and technical
- **Content**: Visual conditions, lighting, photography opportunities
- **Example**: "Perfect lighting at Pleasure Point today! Morning light is incredible, highlighting every wave..."

### Tactical NPCs (Snake, Boss)
- **Style**: Military precision and analysis
- **Content**: Strategic assessments, tactical conditions
- **Example**: "Tactical assessment: Ocean Beach conditions optimal for aquatic operations. Wave height 3-4 feet..."

### Competitor NPCs
- **Style**: Performance focused and intense
- **Content**: Training conditions, performance metrics
- **Example**: "Solid training session at Huntington Beach! Conditions pushed my performance to the next level..."

## Beach Type Adaptations

Content adapts to different beach characteristics:

### Beginner Beaches (Cowell, La Jolla Shores)
- **Reviews**: Focus on safe learning environment, gentle conditions
- **Intel**: Parking for beginners, calm condition updates, safety info

### Advanced Beaches (Mavericks, Pipeline)
- **Reviews**: Emphasize challenging conditions, expert territory
- **Intel**: Hazard warnings, swell direction intel, expert-only updates

### Popular Beaches (Huntington, Malibu)
- **Reviews**: Social scene, busy but fun atmosphere
- **Intel**: Crowd management, parking challenges, timing tips

## Verification Queries

After seeding, use these SQL queries to verify the results:

### Check Review Distribution
```sql
SELECT 
  b.name, 
  COUNT(br.id) as review_count,
  ROUND(AVG(br.overall_rating), 1) as avg_rating
FROM beaches b 
LEFT JOIN beach_reviews br ON b.id = br.beach_id 
GROUP BY b.id, b.name 
ORDER BY review_count DESC;
```

### Check Intel Post Distribution
```sql
SELECT 
  tag, 
  COUNT(*) as post_count,
  COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as recent_posts
FROM intel_posts 
GROUP BY tag 
ORDER BY post_count DESC;
```

### Check NPC Activity
```sql
SELECT 
  p.full_name,
  COUNT(DISTINCT br.id) as reviews,
  COUNT(DISTINCT ip.id) as intel_posts,
  COUNT(DISTINCT br.beach_id) as beaches_reviewed
FROM profiles p 
LEFT JOIN beach_reviews br ON p.id = br.user_id 
LEFT JOIN intel_posts ip ON p.id = ip.user_id 
WHERE p.is_mock = true 
GROUP BY p.id, p.full_name
ORDER BY (reviews + intel_posts) DESC;
```

### Check Recent Activity Timeline
```sql
SELECT 
  DATE(created_at) as activity_date,
  COUNT(CASE WHEN 'beach_reviews' = 'beach_reviews' THEN 1 END) as reviews,
  COUNT(CASE WHEN 'intel_posts' = 'intel_posts' THEN 1 END) as intel_posts
FROM (
  SELECT created_at, 'beach_reviews' as type FROM beach_reviews 
  WHERE user_id IN (SELECT id FROM profiles WHERE is_mock = true)
  UNION ALL
  SELECT created_at, 'intel_posts' as type FROM intel_posts 
  WHERE user_id IN (SELECT id FROM profiles WHERE is_mock = true)
) combined
GROUP BY DATE(created_at)
ORDER BY activity_date DESC
LIMIT 30;
```

## Safety Features

### Environment Validation
- Requires explicit target confirmation (DEV/PROD)
- Production requires additional `CONFIRM_PROD=YES` flag
- Validates all required environment variables

### Data Protection
- Only operates on users with `is_mock=true`
- Optional `RESEED=1` flag for cleanup (never touches real user data)
- Transactional operations where possible

### Error Handling
- Comprehensive error reporting
- Graceful failure with detailed error messages
- Validates database connections before proceeding

## Troubleshooting

### No Mock Users Found
```bash
Error: No mock users found. Please create mock users first with is_mock=true
```
**Solution**: Run the mock user seeding script first or manually create mock users with `is_mock=true` in the profiles table.

### Missing Environment Variables
```bash
Error: Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
```
**Solution**: Set all required environment variables before running the script.

### Rating Columns Mismatch
```bash
Error: RATING_COLS must contain exactly 5 comma-separated column names
```
**Solution**: Verify your beach_reviews table schema and update the RATING_COLS environment variable accordingly.

### Production Safety Error
```bash
Error: Production seeding requires CONFIRM_PROD=YES
```
**Solution**: Add `CONFIRM_PROD=YES` to your environment variables when running production seeding.

## Performance Considerations

- **Runtime**: Typically 30-60 seconds depending on number of beaches and users
- **Database Impact**: Creates 2-6 records per beach (reviews + intel posts)
- **Memory Usage**: Minimal - processes data in batches
- **Network**: Makes multiple small API calls rather than large bulk inserts

## Best Practices

1. **Test First**: Always test in development before running in production
2. **Backup**: Create a database backup before running in production
3. **Monitor**: Watch the console output for any errors during seeding
4. **Verify**: Run the verification queries after seeding to ensure expected results
5. **Clean Setup**: Use `RESEED=1` for consistent results during development

## Integration with Quiver

This seeding script is designed to work seamlessly with Quiver's community features:

- **Beach Reviews**: Populate the beach detail pages with authentic user feedback
- **Local Intel**: Make the Local Intel Club feature feel active and useful
- **Social Proof**: Create a sense of community activity for new users
- **Testing**: Provide realistic data for testing community features

The generated content maintains high quality and authenticity while being clearly identifiable as mock data through the `is_mock` flag on user profiles.