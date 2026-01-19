# Persona-Based E2E Testing Framework

This document describes the persona-based end-to-end testing system for Quiver, which uses 6 NPC (Non-Player Character) personalities to simulate diverse user behaviors and validate user-generated content features.

## Table of Contents

- [Overview](#overview)
- [Persona Definitions](#persona-definitions)
- [Architecture](#architecture)
- [Setup Guide](#setup-guide)
- [Running Persona Tests](#running-persona-tests)
- [Writing Persona-Aware Tests](#writing-persona-aware-tests)
- [Content Generation](#content-generation)
- [Adding New Personas](#adding-new-personas)
- [Troubleshooting](#troubleshooting)

---

## Overview

The persona testing framework enables multi-user E2E testing by:

1. **Simulating diverse users** - 6 distinct personality types with unique writing styles
2. **Generating realistic content** - Intel posts and session notes matching each persona's voice
3. **Parallel test execution** - Each persona maintains independent authentication state
4. **Cross-persona validation** - Testing social features like follows, comments, and interactions

### Why Persona Testing?

Traditional E2E tests use a single test user, which limits testing of:

- Social features (following, community interactions)
- Content diversity (different writing styles, experience levels)
- Multi-user workflows (intel posts from various community members)
- Experience-level filtering (beginner vs expert content)

Persona testing addresses these gaps by providing authenticated mock users with distinct characteristics.

---

## Persona Definitions

### The 6 Personas

| Persona | Mock User | Email | Experience | Writing Style |
|---------|-----------|-------|------------|---------------|
| **Rookie** | Riley R. | `riley.r@example.invalid` | Beginner | Enthusiastic and grateful |
| **Local** | Local Larry | `local.larry@example.invalid` | Expert | Knowledgeable and helpful |
| **Traveler** | Tina C. | `tina.c@example.invalid` | Intermediate | Comparative and adventurous |
| **Photographer** | P. Martinez | `p.martinez@example.invalid` | Intermediate | Aesthetic and technical |
| **Tactical** | Solid Snake | `solid.snake@example.invalid` | Advanced | Military precision and analysis |
| **Competitor** | Kai N. | `kai.n@example.invalid` | Expert | Performance-focused and intense |

### Persona Details

#### Rookie (Riley R.)

- **Experience Level:** Beginner
- **Rating Range:** 4-5 (always positive)
- **Style:** Enthusiastic and grateful
- **Characteristic Phrases:** "OMG!", "So stoked!", "Best day ever!", "Mind blown!"
- **Typical Content:** First-time experiences, learning progress, gratitude to community
- **Wave Heights:** 1-2 ft, 2-3 ft, knee to waist

#### Local (Local Larry)

- **Experience Level:** Expert
- **Rating Range:** 3-5 (balanced, honest)
- **Style:** Knowledgeable and helpful
- **Characteristic Phrases:** "Heads up", "Pro tip", "Been coming here for years", "Local knowledge"
- **Typical Content:** Condition updates, crowd reports, local knowledge
- **Wave Heights:** 3-4 ft, 4-5 ft, waist to chest, chest to head

#### Traveler (Tina C.)

- **Experience Level:** Intermediate
- **Rating Range:** 3-5
- **Style:** Comparative and adventurous
- **Characteristic Phrases:** "Reminds me of", "Different from", "Worth the trip", "Unlike anywhere else"
- **Typical Content:** Beach comparisons, travel insights, new discoveries
- **Wave Heights:** 3-4 ft, 4-6 ft, overhead

#### Photographer (P. Martinez)

- **Experience Level:** Intermediate
- **Rating Range:** 3-5
- **Style:** Aesthetic and technical
- **Characteristic Phrases:** "Perfect lighting", "Great composition", "Photo worthy", "Golden hour magic"
- **Typical Content:** Visual conditions, light quality, action shots
- **Wave Heights:** 3-4 ft, 4-5 ft, waist to head

#### Tactical (Solid Snake)

- **Experience Level:** Advanced
- **Rating Range:** 3-4 (measured, analytical)
- **Style:** Military precision and analysis
- **Characteristic Phrases:** "Tactical assessment", "Mission parameters", "Field report", "Reconnaissance complete"
- **Typical Content:** Detailed analysis, strategic updates, precision reports
- **Wave Heights:** 3-4 ft, 4-5 ft, 1.2-1.5 meters

#### Competitor (Kai N.)

- **Experience Level:** Expert
- **Rating Range:** 3-5
- **Style:** Performance-focused and intense
- **Characteristic Phrases:** "Training session", "Performance analysis", "Pushing limits", "Competition ready"
- **Typical Content:** Training conditions, performance metrics, competitive intel
- **Wave Heights:** 4-6 ft, overhead, head high+

---

## Architecture

### Directory Structure

```
e2e/
├── fixtures/
│   └── personas.ts              # Persona type definitions and utilities
│
├── utils/
│   ├── persona-auth.ts          # Authentication utilities for personas
│   ├── persona-content-generators.ts  # Content generation for each persona
│   └── persona-helpers.ts       # High-level test helpers
│
├── personas/                    # Per-persona test specs
│   ├── rookie.spec.ts
│   ├── local.spec.ts
│   ├── traveler.spec.ts
│   ├── photographer.spec.ts
│   ├── tactical.spec.ts
│   └── competitor.spec.ts
│
├── persona-features/            # Cross-persona feature tests
│   ├── intel-posts.spec.ts
│   ├── session-logging.spec.ts
│   ├── session-planning.spec.ts
│   ├── discovery-follow.spec.ts
│   └── profiles.spec.ts
│
├── persona-setup.ts             # Authentication setup script
│
└── .auth/                       # Auth state files (generated)
    ├── rookie-state.json
    ├── local-state.json
    ├── traveler-state.json
    ├── photographer-state.json
    ├── tactical-state.json
    └── competitor-state.json
```

### Key Components

#### 1. Persona Definitions (`e2e/fixtures/personas.ts`)

Exports:

- `PersonaType` - Union type of all persona identifiers
- `ALL_PERSONA_TYPES` - Array for iteration
- `Persona` - Interface defining persona properties
- `PERSONAS` - Record mapping types to full persona objects
- `getPersona()` - Get persona by type
- `getRandomPhrase()` - Get random characteristic phrase
- `getPersonaRating()` - Get rating within persona's expected range
- `getPersonaPassword()` - Get auth password from env
- `INTEL_TAGS` - Available intel post tags
- `PERSONA_PREFERRED_TAGS` - Preferred tags by persona

#### 2. Auth Utilities (`e2e/utils/persona-auth.ts`)

Exports:

- `getPersonaAuthStatePath()` - Get auth state file path
- `personaAuthStateExists()` - Check if auth state exists
- `isPersonaAuthValid()` - Validate auth state file
- `authenticatePersona()` - Authenticate single persona
- `authenticateAllPersonas()` - Authenticate all personas
- `getPersonaContext()` - Get browser context with persona auth
- `createPersonaPage()` - Create page with persona auth loaded

#### 3. Content Generators (`e2e/utils/persona-content-generators.ts`)

Exports:

- `generateIntelContent()` - Generate persona-style intel posts
- `generateSessionNotes()` - Generate persona-style session notes
- `generateSessionContent()` - Generate complete session data
- `verifyPersonaContent()` - Validate content matches persona patterns

#### 4. Test Helpers (`e2e/utils/persona-helpers.ts`)

Exports:

- `navigateToBeach()` - Navigate to beach page
- `createIntelPostAsPersona()` - Create intel post via UI
- `logSessionAsPersona()` - Log session via UI
- `followUserAsPersona()` - Follow another user
- `updateProfileAsPersona()` - Update profile settings
- `verifyLoggedInAsPersona()` - Verify correct persona logged in
- `exploreDiscoveryAsPersona()` - Use discovery with persona filters
- `checkSessionPlannerAsPersona()` - Check session planner
- `verifyProfileExperienceLevel()` - Verify profile experience level

---

## Setup Guide

### Prerequisites

1. **Mock users must exist in the database**

   Run the mock user seeding script first:

   ```bash
   yarn seed:prod-mock-users
   ```

   This creates the 6 persona accounts with:
   - Auth users in Supabase (email confirmed)
   - Profile records with `is_mock=true`
   - Boards associated with each user

2. **Set persona password** (REQUIRED)

   All personas use the same password. Set via environment variable:

   ```bash
   # In .env.playwright or .env.playwright.local
   PERSONA_PASSWORD=your-test-password
   ```

   **Note:** Password is required for non-localhost environments. The default fallback (`testpassword123`) only works when running against localhost.

3. **Seed mock users with email confirmation** (for E2E login)

   When seeding mock users, enable email confirmation so they can log in:

   ```bash
   PERSONA_PASSWORD=your-password ALLOW_MOCK_EMAIL_CONFIRM=true yarn seed:prod-mock-users
   ```

### Authenticating Personas

Run the setup script to authenticate all personas and save their auth states:

```bash
# Authenticate against localhost
yarn test:e2e:persona-setup

# Authenticate against dev environment
BASE_URL=https://dev.quiversurf.app yarn test:e2e:persona-setup

# With verbose logging
VERBOSE=true yarn test:e2e:persona-setup
```

The script will:

1. Launch a browser for each persona
2. Navigate to the app and log in
3. Save auth state to `e2e/.auth/{persona}-state.json`
4. Report success/failure for each persona

**Output Example:**

```
============================================================
  Quiver Persona Authentication Setup
============================================================

Target URL: http://localhost:3000
Personas to authenticate: 6

Persona Accounts:
  - Riley R. (Rookie): riley.r@example.invalid
  - Local Larry: local.larry@example.invalid
  - Tina C. (Traveler): tina.c@example.invalid
  - P. Martinez (Photographer): p.martinez@example.invalid
  - Solid Snake (Tactical): solid.snake@example.invalid
  - Kai N. (Competitor): kai.n@example.invalid

[Persona Setup] Authenticating 6 personas...
[Persona Setup] Riley R. (Rookie) authenticated
[Persona Setup] Local Larry authenticated
...

============================================================
  Results
============================================================

Authenticated:
  [OK] Riley R. (Rookie)
       State: e2e/.auth/rookie-state.json
  ...

Total time: 45.3s
Success: 6/6

All personas authenticated successfully!
```

---

## Running Persona Tests

### Run All Persona Tests

```bash
# Run all persona and cross-persona feature tests
yarn test:e2e:personas

# Run with UI mode
yarn test:e2e:personas --ui

# Run with browser visible
yarn test:e2e:personas --headed
```

### Run Specific Persona Tests

```bash
# Run only rookie tests
yarn test:e2e e2e/personas/rookie.spec.ts

# Run only local tests
yarn test:e2e e2e/personas/local.spec.ts

# Run cross-persona intel tests
yarn test:e2e e2e/persona-features/intel-posts.spec.ts
```

### Run Against Dev Environment

```bash
# First authenticate against dev
BASE_URL=https://dev.quiversurf.app yarn test:e2e:persona-setup

# Then run tests
yarn test:e2e:personas:dev
```

### Playwright Configuration

Persona tests are configured as a separate project in `playwright.config.ts`:

```typescript
{
  name: 'personas',
  testMatch: ['e2e/personas/**/*.spec.ts', 'e2e/persona-features/**/*.spec.ts'],
  use: {
    ...devices['Desktop Chrome'],
    // Fallback storageState - individual tests override via test.use()
    storageState: 'e2e/.auth/rookie-state.json',
  },
}
```

---

## Writing Persona-Aware Tests

### Basic Per-Persona Test

```typescript
import { test, expect } from '@playwright/test';
import { PERSONAS } from '../fixtures/personas';
import { getPersonaAuthStatePath } from '../utils/persona-auth';

const PERSONA_TYPE = 'local' as const;
const persona = PERSONAS[PERSONA_TYPE];

// Use this persona's auth state
test.use({
  storageState: getPersonaAuthStatePath(PERSONA_TYPE),
});

test.describe(`${persona.displayName} Tests`, () => {
  test('can view home page as authenticated user', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Verify authenticated state
    const userMenu = page.getByTestId('user-menu');
    await expect(userMenu).toBeVisible();
  });
});
```

### Using Content Generators

```typescript
import {
  generateIntelContent,
  generateSessionContent,
  verifyPersonaContent
} from '../utils/persona-content-generators';

test('generates content matching persona style', async () => {
  const beach = { name: 'Trestles', city: 'San Clemente', state: 'California' };

  // Generate intel post
  const intel = generateIntelContent('local', beach, 'conditions');
  expect(intel.title).toContain('Trestles');
  expect(intel.tag).toBe('conditions');

  // Verify content matches local style
  const verification = verifyPersonaContent('local', intel.description);
  expect(verification.isValid).toBe(true);
  expect(verification.matchedPhrases.length).toBeGreaterThan(0);

  // Generate session
  const session = generateSessionContent('local');
  expect(session.rating).toBeGreaterThanOrEqual(3);
  expect(session.rating).toBeLessThanOrEqual(5);
});
```

### Using Test Helpers

```typescript
import {
  createIntelPostAsPersona,
  logSessionAsPersona,
  verifyLoggedInAsPersona
} from '../utils/persona-helpers';

test('can create intel post', async ({ page }) => {
  // Verify correct persona
  const verification = await verifyLoggedInAsPersona(page, 'traveler');
  expect(verification.isCorrectPersona).toBe(true);

  // Create intel post
  const result = await createIntelPostAsPersona(page, 'traveler', {
    beach: { name: 'Pipeline', city: 'Haleiwa', state: 'Hawaii' },
    tag: 'conditions',
  });

  if (result.success) {
    expect(result.content.title).toBeTruthy();
    expect(result.content.description).toContain('Pipeline');
  }
});
```

### Cross-Persona Tests

For tests that need multiple personas:

```typescript
import { test, expect, Browser } from '@playwright/test';
import { ALL_PERSONA_TYPES, PERSONAS } from '../fixtures/personas';
import { createPersonaPage, personaAuthStateExists } from '../utils/persona-auth';

test.describe('Cross-Persona Feature', () => {
  // Test each persona
  for (const personaType of ALL_PERSONA_TYPES) {
    const persona = PERSONAS[personaType];

    test(`${persona.displayName} can use feature`, async ({ browser }) => {
      // Skip if auth state doesn't exist
      if (!personaAuthStateExists(personaType)) {
        test.skip();
        return;
      }

      // Create page with this persona's auth
      const { page, context } = await createPersonaPage(browser, personaType);

      try {
        await page.goto('/feature');
        // Test feature...
      } finally {
        await context.close();
      }
    });
  }
});
```

### Testing Content Style Verification

```typescript
test('verifies persona writing styles', () => {
  // Rookie should have enthusiastic content
  const rookieContent = "OMG! Best session ever! So stoked about these waves!";
  const rookieVerification = verifyPersonaContent('rookie', rookieContent);
  expect(rookieVerification.isValid).toBe(true);

  // Tactical should have military terminology
  const tacticalContent = "Tactical assessment complete. Mission parameters optimal.";
  const tacticalVerification = verifyPersonaContent('tactical', tacticalContent);
  expect(tacticalVerification.isValid).toBe(true);

  // Wrong style should not match
  const mismatchVerification = verifyPersonaContent('rookie', tacticalContent);
  expect(mismatchVerification.matchedPhrases.length).toBe(0);
});
```

---

## Content Generation

### Intel Post Generation

The `generateIntelContent()` function creates persona-appropriate intel posts:

```typescript
const content = generateIntelContent(
  'photographer',           // persona type
  { name: 'Malibu', city: 'Malibu', state: 'California' },  // beach info
  'conditions'              // optional specific tag
);

// Returns:
// {
//   title: 'Perfect light at Malibu',
//   description: 'Golden hour magic at Malibu! Morning light is incredible...',
//   tag: 'conditions'
// }
```

### Session Notes Generation

```typescript
const notes = generateSessionNotes('competitor');
// Returns: "Next level session! Hit every section hard. Working on my rail game..."

const fullSession = generateSessionContent('competitor');
// Returns:
// {
//   notes: "...",
//   rating: 4,              // within persona's 3-5 range
//   waveHeight: 'overhead', // persona-appropriate
//   crowdLevel: 3           // 1-5
// }
```

### Available Intel Tags

- `conditions` - Wave and weather conditions
- `parking` - Parking availability and tips
- `crowd` - Crowd levels and behavior
- `hazards` - Safety warnings and hazards
- `access` - Beach access and facilities

### Preferred Tags by Persona

| Persona | Preferred Tags |
|---------|---------------|
| Rookie | conditions, access |
| Local | conditions, crowd, hazards |
| Traveler | conditions, parking, access |
| Photographer | conditions |
| Tactical | hazards, conditions, access |
| Competitor | conditions, crowd |

---

## Adding New Personas

### Step 1: Add Mock User

Add to `scripts/seed-prod-mock-users.ts`:

```typescript
const mockUsers = [
  // ... existing users
  {
    name: 'New Persona Name',
    email: 'new.persona@example.invalid',
    yearsExperience: 2,
    experienceLevel: 'intermediate', // beginner | intermediate | advanced | expert
    favoriteSpot: 'Some Beach',
    board: {
      name: 'Board Name',
      type: 'shortboard',
      dimensions: '6\'0" x 18.5" x 2.3"',
      description: 'Board description'
    }
  }
];
```

Then run: `yarn seed:prod-mock-users`

### Step 2: Add Persona Definition

Add to `e2e/fixtures/personas.ts`:

```typescript
// Add to PersonaType
export type PersonaType =
  | 'rookie'
  | 'local'
  // ... existing types
  | 'newpersona';

// Add to ALL_PERSONA_TYPES
export const ALL_PERSONA_TYPES: PersonaType[] = [
  // ... existing
  'newpersona',
];

// Add to PERSONAS
export const PERSONAS: Record<PersonaType, Persona> = {
  // ... existing personas

  newpersona: {
    type: 'newpersona',
    displayName: 'New Persona Name',
    email: 'new.persona@example.invalid',
    style: 'description of writing style',
    phrases: [
      'Characteristic phrase 1',
      'Phrase 2',
      // ... more phrases
    ],
    typicalContent: ['Content type 1', 'Content type 2'],
    expectedRatingRange: [3, 5],
    experienceLevel: 'intermediate',
  },
};

// Add to PERSONA_PREFERRED_TAGS
export const PERSONA_PREFERRED_TAGS: Record<PersonaType, IntelTag[]> = {
  // ... existing
  newpersona: ['conditions', 'crowd'],
};
```

### Step 3: Add Content Templates

Add to `e2e/utils/persona-content-generators.ts`:

```typescript
// Add to INTEL_TITLE_TEMPLATES
const INTEL_TITLE_TEMPLATES: Record<PersonaType, Record<IntelTag, string[]>> = {
  // ... existing
  newpersona: {
    conditions: [
      '{beach} looking great!',
      'Update from {beach}',
    ],
    parking: [...],
    crowd: [...],
    hazards: [...],
    access: [...],
  },
};

// Add to INTEL_DESCRIPTION_TEMPLATES
const INTEL_DESCRIPTION_TEMPLATES: Record<PersonaType, Record<IntelTag, string[]>> = {
  // ... existing
  newpersona: {
    conditions: [
      '{phrase} conditions at {beach} are solid today...',
    ],
    // ... other tags
  },
};

// Add to SESSION_NOTES_TEMPLATES
const SESSION_NOTES_TEMPLATES: Record<PersonaType, string[]> = {
  // ... existing
  newpersona: [
    '{phrase} Great session today...',
    'Another good one in the books...',
  ],
};

// Add to styleKeywords in verifyPersonaContent
const styleKeywords: Record<PersonaType, string[]> = {
  // ... existing
  newpersona: ['keyword1', 'keyword2', ...],
};

// Add to waveHeights in generateSessionContent
const waveHeights = {
  // ... existing
  newpersona: ['3-4 ft', '4-5 ft'],
};
```

### Step 4: Create Test Spec

Create `e2e/personas/newpersona.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { PERSONAS } from '../fixtures/personas';
import { getPersonaAuthStatePath } from '../utils/persona-auth';
import { generateIntelContent, verifyPersonaContent } from '../utils/persona-content-generators';

const PERSONA_TYPE = 'newpersona' as const;
const persona = PERSONAS[PERSONA_TYPE];

test.use({
  storageState: getPersonaAuthStatePath(PERSONA_TYPE),
});

test.describe(`${persona.displayName} Persona Tests`, () => {
  test('has correct persona characteristics', () => {
    expect(persona.experienceLevel).toBe('intermediate');
    expect(persona.expectedRatingRange).toEqual([3, 5]);
  });

  test('generates style-appropriate content', () => {
    const content = generateIntelContent(PERSONA_TYPE,
      { name: 'Test Beach', city: 'Test City', state: 'CA' }
    );
    const verification = verifyPersonaContent(PERSONA_TYPE, content.description);
    expect(verification.isValid).toBe(true);
  });
});
```

### Step 5: Authenticate New Persona

```bash
yarn test:e2e:persona-setup
```

---

## Troubleshooting

### Auth Setup Fails

**Symptom:** `yarn test:e2e:persona-setup` fails for one or more personas.

**Common Causes:**

1. **Mock users not seeded**
   ```bash
   yarn seed:prod-mock-users
   ```

2. **Wrong password**
   ```bash
   # Check/set password
   export PERSONA_PASSWORD=correct-password
   yarn test:e2e:persona-setup
   ```

3. **Users need password reset**
   - Check Supabase Auth dashboard
   - Ensure users have confirmed emails and valid passwords

4. **Network/timeout issues**
   ```bash
   VERBOSE=true yarn test:e2e:persona-setup
   ```

### Tests Fail with "Auth state not found"

**Symptom:** Tests fail with error about missing auth state file.

**Solution:** Run persona setup first:
```bash
yarn test:e2e:persona-setup
```

### Content Verification Fails

**Symptom:** `verifyPersonaContent()` returns `isValid: false`.

**Check:**
1. Content templates include persona phrases
2. Style keywords are comprehensive
3. Generated content includes expected patterns

### Cross-Persona Tests Timeout

**Symptom:** Tests creating multiple browser contexts timeout.

**Solutions:**
1. Increase timeout in test file:
   ```typescript
   test.setTimeout(60000);
   ```

2. Run with fewer workers:
   ```bash
   yarn test:e2e:personas --workers=1
   ```

### Environment-Specific Issues

**Auth states are environment-specific.** When switching between localhost and dev:

```bash
# Reset auth states
rm e2e/.auth/*-state.json

# Re-authenticate for target environment
BASE_URL=https://dev.quiversurf.app yarn test:e2e:persona-setup
```

---

## Best Practices

### 1. Always Verify Persona Before Test Actions

```typescript
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  const result = await verifyLoggedInAsPersona(page, PERSONA_TYPE);
  expect(result.isCorrectPersona || result.currentUser).toBeTruthy();
});
```

### 2. Use Content Generators for Realistic Data

```typescript
// Good: Generated content matches persona
const content = generateIntelContent('tactical', beach, 'hazards');

// Avoid: Generic content
const content = { title: 'Test', description: 'Test description' };
```

### 3. Clean Up Created Content

```typescript
test.afterEach(async ({ page }) => {
  // Delete test-created intel posts, sessions, etc.
});
```

### 4. Test Content Style Verification

```typescript
test('content matches persona style', () => {
  const content = generateIntelContent(PERSONA_TYPE, beach);
  const verification = verifyPersonaContent(PERSONA_TYPE, content.description);
  expect(verification.isValid).toBe(true);
});
```

### 5. Handle UI Availability Gracefully

```typescript
test('can post intel (if UI available)', async ({ page }) => {
  const result = await createIntelPostAsPersona(page, PERSONA_TYPE, options);

  if (result.success) {
    expect(result.content.title).toBeTruthy();
  } else {
    console.log(`Skipped: ${result.error}`);
  }
});
```

---

## Resources

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [E2E Architecture](./ARCHITECTURE.md) - Main E2E testing documentation
- [Persona Definitions](./fixtures/personas.ts) - Source code for persona types
- [Mock User Seeding](../scripts/seed-prod-mock-users.ts) - Database seeding script

---

**Last Updated:** January 18, 2026
