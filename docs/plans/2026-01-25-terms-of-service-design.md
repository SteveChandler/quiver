# Terms of Service Design

**Date:** 2026-01-25
**Status:** Approved

## Overview

Add a Terms of Service page and require consent during signup. Users must check a box agreeing to Terms and Privacy Policy before creating an account.

## Implementation Summary

### New Files

- `/app/terms/page.tsx` - Terms of Service page (mirrors Privacy page structure)
- Add `TERMS_CONTENT` to `/lib/constants/content.ts`

### Modified Files

- `/components/auth/unified-auth-modal.tsx` - Add consent checkbox to signup flow
- `/components/landing-page/footer-section.tsx` - Add Terms link
- `/lib/auth/auth-utils.ts` - Pass consent metadata to signup

## Technical Design

### Consent Storage

Store in Supabase `raw_user_meta_data` during signup:

```typescript
{
  terms_accepted_at: "2026-01-25T10:30:00Z",
  terms_version: "2026-01-25",
  privacy_accepted_at: "2026-01-25T10:30:00Z"
}
```

Benefits:
- No new database table
- Travels with user record
- Version tracking for future re-consent flows
- Works with email and OAuth signup

### Signup Flow Changes

1. Add checkbox below password field in `EmailPasswordForm`
2. Add checkbox to `AuthProviders` view (shown before OAuth buttons in signup mode)
3. Checkbox text: "I agree to the [Terms of Service] and [Privacy Policy]"
4. Submit button disabled until checkbox is checked
5. Pass consent timestamp to `signUp()` and OAuth metadata

### Page Structure

Terms page follows same design as Privacy page:
- Navigation bar
- Hero section with title and last updated date
- Sections with cards
- Quick navigation
- Contact section
- Footer

---

## Terms of Service Content

### TERMS OF SERVICE

*Last Updated: January 25, 2026*

Welcome to Quiver. These Terms of Service ("Terms") govern your use of the Quiver application, website, and services (collectively, the "Service"). By accessing or using Quiver, you agree to be bound by these Terms and our Privacy Policy.

### 1. Acceptance of Terms

By creating an account or using Quiver, you confirm that you are at least 13 years old and agree to these Terms. If you are under 18, you represent that your parent or guardian has reviewed and agreed to these Terms on your behalf. If you do not agree, do not use the Service.

### 2. Description of Service

Quiver provides surf forecasting, beach condition information, session tracking, and community features for surfers. Our Service includes:
- Surf condition forecasts and predictions
- Real-time weather and ocean data
- Beach and surf spot information
- Personal session logging and statistics
- Community features including reviews and local intel

### 3. User Accounts

To access certain features, you must create an account. You agree to:
- Provide accurate, current information during registration
- Maintain the security of your password and account
- Notify us immediately of any unauthorized access
- Accept responsibility for all activity under your account

We reserve the right to suspend or terminate accounts that violate these Terms or remain inactive for extended periods.

### 4. User Content

You retain ownership of content you submit (session logs, reviews, photos, comments). By posting content, you grant Quiver a worldwide, non-exclusive, royalty-free license to use, display, reproduce, and distribute your content in connection with the Service.

You agree not to post content that:
- Is false, misleading, or defamatory
- Infringes intellectual property rights
- Contains harassment, hate speech, or threats
- Is spam or commercial solicitation
- Violates any applicable law

We may remove content that violates these Terms without notice.

### 5. Surf Forecast Disclaimer

QUIVER PROVIDES SURF FORECASTS, WAVE PREDICTIONS, AND OCEAN CONDITION INFORMATION FOR GENERAL INFORMATIONAL PURPOSES ONLY. THIS INFORMATION IS NOT A SUBSTITUTE FOR YOUR OWN JUDGMENT, LOCAL KNOWLEDGE, OR PROFESSIONAL INSTRUCTION.

You acknowledge and agree that:
- Ocean conditions are inherently unpredictable and can change rapidly
- Forecasts are predictions based on available data and may be inaccurate
- Local conditions may differ significantly from forecasted conditions
- You are solely responsible for assessing conditions before entering the water
- Quiver does not guarantee the accuracy, completeness, or timeliness of any forecast

### 6. Assumption of Risk

SURFING AND OCEAN ACTIVITIES ARE INHERENTLY DANGEROUS AND CAN RESULT IN SERIOUS INJURY OR DEATH. By using Quiver, you acknowledge that you understand these risks and voluntarily assume full responsibility for any injury, loss, or damage that may occur.

Risks include but are not limited to:
- Drowning
- Collisions with other surfers, watercraft, or marine life
- Impact with the ocean floor, rocks, or reef
- Dangerous currents, rip tides, and shore break
- Hypothermia and sun exposure
- Equipment failure

Quiver does not assess your skill level, physical condition, or ability to handle specific conditions. You are solely responsible for making safe decisions.

### 7. Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY LAW, QUIVER AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO PERSONAL INJURY, DEATH, PROPERTY DAMAGE, LOSS OF DATA, OR LOSS OF PROFITS, ARISING FROM YOUR USE OF THE SERVICE.

IN NO EVENT SHALL QUIVER'S TOTAL LIABILITY EXCEED THE AMOUNT YOU PAID TO QUIVER IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM, OR ONE HUNDRED DOLLARS ($100), WHICHEVER IS GREATER.

Some jurisdictions do not allow limitation of liability for personal injury or death. In such jurisdictions, our liability is limited to the maximum extent permitted by law.

### 8. Indemnification

You agree to indemnify and hold harmless Quiver and its affiliates from any claims, damages, losses, or expenses (including legal fees) arising from your use of the Service, your content, or your violation of these Terms.

### 9. Acceptable Use

You agree not to:
- Use the Service for any illegal purpose
- Attempt to gain unauthorized access to any part of the Service
- Interfere with or disrupt the Service or servers
- Scrape, crawl, or collect data without permission
- Impersonate others or misrepresent your affiliation
- Use automated systems to access the Service without permission
- Reverse engineer or attempt to extract source code

### 10. Intellectual Property

The Service, including its design, features, content, and trademarks, is owned by Quiver and protected by intellectual property laws. You may not copy, modify, distribute, or create derivative works without our written permission.

### 11. Third-Party Services

Quiver integrates with third-party services for maps, weather data, and other features. Your use of these services is subject to their respective terms and privacy policies. Quiver is not responsible for third-party content or services.

### 12. Termination

We may suspend or terminate your access to the Service at any time, with or without cause, with or without notice. Upon termination, your right to use the Service ceases immediately. Provisions that by their nature should survive termination (including disclaimers, limitations of liability, and indemnification) shall survive.

### 13. Dispute Resolution and Arbitration

**PLEASE READ THIS SECTION CAREFULLY. IT AFFECTS YOUR LEGAL RIGHTS, INCLUDING YOUR RIGHT TO FILE A LAWSUIT IN COURT.**

**Agreement to Arbitrate:** You and Quiver agree that any dispute, claim, or controversy arising out of or relating to these Terms or the Service (collectively, "Disputes") will be resolved by binding individual arbitration rather than in court, except that either party may bring individual claims in small claims court if they qualify.

**Class Action Waiver:** YOU AND QUIVER AGREE THAT EACH MAY BRING CLAIMS AGAINST THE OTHER ONLY IN YOUR OR ITS INDIVIDUAL CAPACITY, AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS, COLLECTIVE, OR REPRESENTATIVE PROCEEDING. Unless both you and Quiver agree otherwise, the arbitrator may not consolidate or join more than one person's claims and may not preside over any form of a representative, class, or collective proceeding.

**Arbitration Rules:** The arbitration will be administered by JAMS under its Streamlined Arbitration Rules and Procedures, or as otherwise agreed by the parties. The arbitration will be conducted in the English language in the county where you reside or another mutually agreed location.

**Opt-Out:** You may opt out of this arbitration agreement by sending written notice to legal@quiversurf.com within 30 days of creating your account. If you opt out, you and Quiver may still resolve Disputes in small claims court or through litigation in accordance with Section 14.

**Severability:** If any part of this arbitration agreement is found unenforceable, the remaining portions shall remain in effect. If the class action waiver is found unenforceable for a particular claim, then the entire arbitration agreement shall be null and void for that claim only, and the Dispute shall proceed in court.

### 14. Governing Law

These Terms are governed by the laws of the State of California, United States, without regard to conflict of law principles. For any Disputes not subject to arbitration, you agree to submit to the personal and exclusive jurisdiction of the state and federal courts located in California.

### 15. Changes to Terms

We may update these Terms from time to time. We will notify you of material changes by posting the new Terms and updating the "Last Updated" date. Your continued use after changes constitutes acceptance of the revised Terms.

### 16. Contact

Questions about these Terms? Contact us at:
- Email: legal@quiversurf.com
- Website: quiversurf.com

---

## Implementation Tasks

1. **Create Terms content constant** - Add `TERMS_CONTENT` to `/lib/constants/content.ts` following `PRIVACY_CONTENT` structure
2. **Create Terms page** - `/app/terms/page.tsx` mirroring Privacy page design
3. **Add consent checkbox to signup** - Modify `UnifiedAuthModal` to show checkbox in signup mode
4. **Pass consent metadata** - Update `signUp()` call to include terms/privacy acceptance timestamps
5. **Update OAuth flow** - Pass consent metadata through OAuth signup
6. **Add footer link** - Add Terms link to footer alongside Privacy
7. **Test signup flows** - Verify checkbox blocks signup until checked, metadata is stored

## Notes

- Have a lawyer review before going live (especially arbitration clause)
- Consider adding Terms link to app store listings
- Current date used as `terms_version` for tracking
- Arbitration clause modeled after Surfline's approach - includes 30-day opt-out window
- JAMS specified as arbitration administrator (industry standard)
