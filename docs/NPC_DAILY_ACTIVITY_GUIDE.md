# NPC Daily Activity Seeder - Implementation Guide

## Overview

The NPC Daily Activity Seeder automatically creates realistic community content daily to keep Quiver's production environment feeling alive and engaging. It randomly selects 3-5 mock users (NPCs) each day to create sessions, intel posts, and beach reviews with personality-driven content.

## 🚀 Quick Start

### Manual Execution

```bash
# Development environment
CONFIRM_TARGET=DEV npm run npc:daily

# Production environment (requires confirmation)
CONFIRM_TARGET=PROD CONFIRM_PROD=YES npm run npc:daily
```

### GitHub Actions (Automated)

The system runs automatically daily at 9am PT (17:00 UTC) via GitHub Actions workflow `.github/workflows/npc-daily.yml`.

## 📁 Files Created

| File | Purpose |
|------|---------|
| `scripts/npc-daily-activity.ts` | Main seeder script |
| `.github/workflows/npc-daily.yml` | Daily automation workflow |
| `scripts/verify-npc-activity.sql` | Verification queries |
| `docs/NPC_DAILY_ACTIVITY_GUIDE.md` | This guide |

## 🎭 Content Generation

### Sessions (`public.sessions`)
- **Quantity**: 1 per selected NPC
- **Timing**: Backdated within last 24 hours
- **Duration**: 45-180 minutes based on personality
- **Notes**: Personality-specific session descriptions
- **Rating**: 3-5 stars (NPCs are positive)

### Intel Posts (`public.intel_posts`)
- **Quantity**: 1 per selected NPC
- **Tags**: conditions, parking, crowd, access
- **Timing**: Backdated within last 24 hours
- **Location**: Beach coordinates with realistic offsets
- **Surf Conditions**: Realistic JSON for conditions posts

### Beach Reviews (`public.beach_reviews`)
- **Quantity**: 1 per selected NPC
- **Timing**: Backdated within last 3 days
- **Ratings**: All 5 columns (3-5 stars each)
- **Content**: Personality-driven titles and reviews

## 🧠 NPC Personalities

| Personality | Session Style | Content Focus | Rating Tendency |
|-------------|---------------|---------------|-----------------|
| **Rookie** | Enthusiastic | Learning progress | High (4-5) |
| **Local** | Knowledgeable | Conditions & tips | Balanced (3-5) |
| **Traveler** | Comparative | Spot comparisons | Balanced (3-5) |
| **Photographer** | Aesthetic | Visual conditions | High (4-5) |
| **Tactical** | Analytical | Precise reports | Precise (4) |
| **Competitor** | Performance | Training focus | Critical (3-4) |

## 🔒 Safety Features

### Environment Validation
- Requires `CONFIRM_TARGET=DEV` or `CONFIRM_TARGET=PROD`
- Production requires `CONFIRM_PROD=YES`
- Validates database connection before proceeding

### Mock User Protection  
- Only operates on users with `is_mock=true`
- Never modifies real user data
- Automatic verification of mock user existence

### Error Handling
- Comprehensive try/catch blocks
- Detailed error logging and reporting
- Graceful failure with informative messages

## 📊 Monitoring & Verification

### Verification Queries
Run the comprehensive verification script:
```sql
-- Execute all verification queries
\i scripts/verify-npc-activity.sql
```

### Key Metrics to Monitor
- Daily content creation (sessions, intel, reviews)
- NPC activity distribution
- Content quality metrics (ratings, tags)
- Beach coverage analysis

### Quick Status Check
```bash
# Check mock user count
npm run check-mock-users

# View recent GitHub Actions runs
gh run list --workflow="Daily NPC Activity Seeder"
```

## ⚙️ Configuration

### Environment Variables

**Required:**
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key
- `CONFIRM_TARGET`: DEV or PROD

**Production Only:**
- `CONFIRM_PROD`: Must be "YES" for production

### GitHub Secrets

Configure these in your repository settings:

**Development:**
- `SUPABASE_DEV_URL`
- `SUPABASE_DEV_SERVICE_ROLE_KEY`

**Production:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## 🔧 Troubleshooting

### Common Issues

**"No mock users found"**
```bash
# Check mock users exist
npm run check-mock-users

# If needed, create mock users first
npm run seed:prod-mock-users
```

**GitHub Actions failing**
- Verify repository secrets are configured
- Check workflow permissions for Actions
- Review logs in Actions tab

**Database connection errors**
- Verify Supabase URL and service key
- Check network connectivity
- Ensure service role has required permissions

### Database Requirements

**Tables needed:**
- `public.profiles` (with `is_mock` column)
- `public.sessions`
- `public.intel_posts`
- `public.beach_reviews`
- `public.beaches`

**Permissions required:**
- INSERT on all content tables
- SELECT on profiles and beaches
- Service role must bypass RLS policies

## 📈 Expected Output

### Daily Volume
- **3-5 sessions** (one per selected NPC)
- **3-5 intel posts** (various tags)
- **3-5 beach reviews** (different beaches)
- **Total**: 9-15 pieces of content daily

### Weekly Trends
- Consistent daily activity Monday-Sunday
- Varied content distribution across beaches
- Natural personality-based content variety

## 🏗️ Architecture Decisions

### Why This Approach?
1. **Realistic Timing**: Backdated content feels natural
2. **Personality Consistency**: Each NPC maintains character
3. **Content Variety**: Multiple types prevent monotony
4. **Safety First**: Multiple protection layers
5. **Monitoring Ready**: Built-in verification tools

### Database Design
- Uses existing table structures
- Respects foreign key constraints
- Maintains data integrity
- Compatible with existing RLS policies

### Performance Considerations
- Batch operations for efficiency
- Minimal database queries
- Error isolation per NPC
- Lightweight daily processing

## 🚀 Future Enhancements

### Potential Improvements
- **Seasonal Variations**: Adjust content for surf seasons
- **Weather Integration**: Sync with actual weather data
- **Community Events**: Generate event-based content
- **Analytics Dashboard**: Web-based monitoring UI
- **A/B Testing**: Measure impact on user engagement

### Scaling Options
- Multiple daily runs (morning/evening)
- Regional content variation
- User engagement response algorithms
- Machine learning content optimization

## 📝 Maintenance

### Regular Tasks
- Monitor GitHub Actions success rate
- Review content quality metrics
- Update personality templates seasonally
- Verify database performance impact

### Emergency Procedures
- **Stop Daily Runs**: Disable GitHub Actions workflow
- **Emergency Cleanup**: Use verification queries to identify issues
- **Rollback**: Remove content by creation date if needed

---

## 🎯 Success Metrics

The NPC Daily Activity Seeder is working correctly when you see:

✅ **Consistent Daily Activity**: 9-15 pieces of content created daily  
✅ **Personality Variety**: Different writing styles and focuses  
✅ **Beach Distribution**: Content spread across multiple beaches  
✅ **Quality Ratings**: NPCs maintaining 3-5 star positive ratings  
✅ **Zero Errors**: Clean GitHub Actions runs with no failures  

This system ensures Quiver always feels like an active, thriving surf community! 🏄‍♀️