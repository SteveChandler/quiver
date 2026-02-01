# Surf Scoring Logic Map

This document maps out the current logic used to calculate surf condition scores. The scoring engine is composite, meaning it sums up weighted scores from 8 different "scorers."

## Why Scores Might Seen Low?

The scoring system is **subtractive**. You start with potential perfection, and every factor that isn't perfect subtracts points. Because there are **8 distinct factors**, it is statistically difficult to get a "Perfect" (>85) or even "Excellent" (>70) score unless _everything_ aligns.

### Key Penalties (The "Score Killers")

1.  **Big Swells (>8ft)**: The system currently penalizes waves larger than 8ft, dropping the base score to 60/100 (Expert Only conditions).
2.  **Tide Direction (15% Weight)**: If a beach prefers "Rising" tide but the tide is "Falling", you lose almost all 15 points for this category.
3.  **Wind Cutoffs**:
    - **Strict Skip**: Any wind > 18mph is an automatic SKIP (Score 0).
    - **Onshore Skip**: Onshore wind > 10mph is an automatic SKIP.
4.  **Swell Alignment**: If the swell angle is even slightly outside the "perfect" window (10% of width), the score drops from 100 to 85, then 70.

---

## Scoring Breakdown (Total: 100 Points)

The final score is composed of these 8 weighted factors:

| Scorer Component       | Weight  | Max Pts | What it Checks                                        |
| :--------------------- | :------ | :------ | :---------------------------------------------------- |
| **Base Conditions**    | **25%** | **25**  | Wave height & Period. Ideal is 2-5ft @ 14s+.          |
| **Swell Alignment**    | **15%** | **15**  | Does the swell hit the beach directly?                |
| **Swell Interference** | **15%** | **15**  | Are there conflicting swells (e.g. crossing)?         |
| **Wind Quality**       | **15%** | **15**  | Offshore (>Glassy) vs Onshore.                        |
| **Tide Direction**     | **15%** | **15**  | Is the tide moving the right way (Rising vs Falling)? |
| **Tide Fit (Height)**  | **5%**  | **5**   | Is the specific tide height (e.g. 3ft) good?          |
| **Window Stability**   | **5%**  | **5**   | Are conditions stable significantly over time?        |
| **Trend Preference**   | **5%**  | **5**   | Are conditions getting better or worse?               |

---

## Critical Gaps & Limitations

_Areas where the scoring logic conflicts with real-world surfing reality._

### 1. ~~The "Expert Cap" Problem~~ - FIXED (Jan 2026)

- **Previous Gap**: The system treated waves > 8ft as "Bad" (Score: 60/100) instead of "Challenging but Epic".
- **Fix Applied**: The scoring system now is skill-level aware:
  - 8ft+ waves score **85/100** as "Epic conditions"
  - User's `experience_level` from profile is used to adjust scores
  - Advanced/Expert users see full scores for big waves
  - Beginners get penalties and warnings for waves exceeding their skill ceiling
  - Skill-based ranges: Beginner (0.5-4ft), Intermediate (1-6ft), Advanced (2-12ft), Expert (2-20ft)

### 2. Binary Tide Penalties

- **Gap**: The "Tide Direction" scorer applies massive penalties (up to -90% of the category score) for the wrong tide movement.
- **Impact**: A "Falling" tide at a "Rising" preference spot drops the total score by ~12 points instantly, even if the tide _height_ is perfect. In reality, many spots are still fun on the wrong tide.

### 3. Brittle Wind Cutoffs

- **Gap**: Strict binary cutoffs for wind.
  - 11mph Onshore = Score 0 (Skip).
  - 19mph Offshore = Score 0 (Skip).
- **Impact**: A fun, windy afternoon session gets completely hidden from the user.

### 4. No "Crowd" or "Vibe" Factor

- **Gap**: The system scores pure oceanography, not the human experience.
- **Impact**: A 100/100 score at a spot with 500 people might be a worse experience than a 80/100 score at an empty secret spot.

### 5. Swell Interaction Blindness

- **Gap**: "Swell Alignment" assumes direct hits are always best.
- **Impact**: Combo swells (e.g. S + NW) that create "peaks" are often penalized as "Interference" rather than rewarded for creating shape.

---

## Detailed Logic Maps

### 1. Base Conditions (25 pts)

_Combines Wave Height (60%) and Period (40%)_

- **Wave Height**:
  - **2ft - 5ft**: Perfect (100%)
  - **1ft - 2ft**: Scaled down (50-100%)
  - **5ft - 8ft**: Scaled down (100-70%)
  - **> 8ft**: Epic conditions (85%) - skill adjustment applied separately
  - **< 0.5ft**: Automatic Skip (Flat)
- **Period**:
  - **> 14s**: Perfect (100%)
  - **10s - 14s**: Good (70-100%)
  - **< 6s**: Poor (<40%)

### 2. Wind Quality (15 pts)

- **Glassy (<3mph)**: Perfect (100%)
- **Offshore**: Excellent (100%), degrades slightly with speed.
- **Cross-shore**: Moderate (70%), degrades quickly.
- **Onshore**: Poor (20-50%).
- **CUTOFFS**: Wind > 18mph OR Onshore > 10mph = **SCORE 0 (SKIP)**

### 3. Swell Alignment (15 pts)

- **Perfect Center**: Swell is within 10% of the beach's ideal window center. (100%)
- **In Window**: Swell is within the window. (70-85%)
- **Just Outside**: Swell is <30 degrees off. (40-70%)
- **Far Outside**: Swell is blocked. (20-40%)

### 4. Tide Direction (15 pts)

_New factor that penalizes wrong tide movement._

- **Match**: E.g. Beach likes "Rising" and tide is Rising. (100%)
- **Mismatch**: Beach likes "Rising" but tide is Falling. (Low Score)

### 5. Swell Interference (15 pts)

- **Clean**: Only one primary swell. (100%)
- **Mixed**: Secondary swell exists but is small. (High score)
- **Confused**: Secondary swell is large and crossing the primary swell. (Penalty)

---

## Skill-Level-Aware Scoring (Added Jan 2026)

The discovery scoring now factors in the user's `experience_level` from their profile.

### Skill-Based Wave Ranges

| Skill Level  | Ideal Range | Acceptable Range | Over-Skill Penalty |
| :----------- | :---------- | :--------------- | :----------------- |
| Beginner     | 1-3 ft      | 0.5-4 ft         | -8 pts per ft over |
| Intermediate | 2-5 ft      | 1-6 ft           | -8 pts per ft over |
| Advanced     | 3-8 ft      | 2-12 ft          | -8 pts per ft over |
| Expert       | 4-12 ft     | 2-20 ft          | -8 pts per ft over |

### How It Works

1. **Skill Ceiling Check**: If waves exceed the user's acceptable maximum, a penalty is applied (-8 pts per ft over, **no cap** for safety)
2. **Preference Matching**: If waves match the user's preferred size, a +5 bonus is applied
3. **Skill Ideal Bonus**: If waves fall in the ideal range for the user's skill (and no preference set), +3 bonus
4. **Softer Preference Penalties**: Wave size preference mismatches now use -5 pts per ft (max -15) instead of the old -12 pts per 0.5ft (max -36)

### Safety Features

- **Default to Beginner**: If no skill level is set in the user's profile, scoring defaults to 'beginner' for safety
- **No Penalty Cap**: Dangerous conditions receive uncapped penalties. A beginner facing 20ft waves gets a score near 0, not 60.
- **Graduated Warnings**:
  - 1-4ft over: "Waves may exceed your skill level"
  - 4-8ft over: "Waves significantly exceed your skill level"
  - 8ft+ over: "Dangerous: Waves far exceed your skill level"

### Example Scenarios

| User          | Waves  | Old Score | New Score | Reason                                 |
| :------------ | :----- | :-------- | :-------- | :------------------------------------- |
| Advanced      | 8 ft   | ~55       | ~85       | Epic conditions, skill appropriate     |
| Beginner      | 8 ft   | ~55       | ~50       | Skill ceiling penalty + warning        |
| Beginner      | 20 ft  | ~55       | ~0        | **Dangerous** - severe penalty applied |
| Intermediate  | 3 ft   | ~70       | ~73       | +3 bonus for ideal skill range         |
| Pref: Medium  | 4 ft   | ~75       | ~80       | +5 bonus for preference match          |
| No skill set  | 6 ft   | ~60       | ~45       | Defaults to beginner, 2ft over limit   |
