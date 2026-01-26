# Terms of Service Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Terms of Service page with consent checkbox during signup, including surf-specific liability disclaimers and arbitration clause.

**Architecture:** Create TERMS_CONTENT constant mirroring PRIVACY_CONTENT structure, build Terms page using Privacy page as template, add consent checkbox to UnifiedAuthModal signup flow, store consent timestamps in user metadata.

**Tech Stack:** Next.js 14 App Router, React, TypeScript, Tailwind CSS, Supabase Auth

---

## Task 1: Add TERMS_CONTENT Constant

**Files:**
- Modify: `lib/constants/content.ts:506` (after PRIVACY_CONTENT)

**Step 1: Add the TERMS_CONTENT export**

Add after line 506 (`} as const;` closing PRIVACY_CONTENT), before FEATURES_EXTENDED_CONTENT:

```typescript
export const TERMS_CONTENT = {
  hero: {
    title: "Terms of Service",
    subtitle: "Rules and guidelines for using Quiver",
    lastUpdated: "January 25, 2026",
    effectiveDate:
      "This policy is effective as of January 25, 2026. We will notify you of any material changes by email or through our app.",
  },
  overview: {
    title: "Welcome to Quiver",
    description:
      "These Terms of Service (\"Terms\") govern your use of the Quiver application, website, and services (collectively, the \"Service\"). By accessing or using Quiver, you agree to be bound by these Terms and our Privacy Policy.",
  },
  sections: [
    {
      id: "acceptance",
      icon: UserCheck,
      title: "1. Acceptance of Terms",
      content: [
        {
          subtitle: "Agreement to Terms",
          details:
            "By creating an account or using Quiver, you confirm that you are at least 13 years old and agree to these Terms. If you are under 18, you represent that your parent or guardian has reviewed and agreed to these Terms on your behalf. If you do not agree, do not use the Service.",
        },
      ],
    },
    {
      id: "service-description",
      icon: Waves,
      title: "2. Description of Service",
      content: [
        {
          subtitle: "What Quiver Provides",
          details:
            "Quiver provides surf forecasting, beach condition information, session tracking, and community features for surfers. Our Service includes: surf condition forecasts and predictions, real-time weather and ocean data, beach and surf spot information, personal session logging and statistics, and community features including reviews and local intel.",
        },
      ],
    },
    {
      id: "user-accounts",
      icon: Users,
      title: "3. User Accounts",
      content: [
        {
          subtitle: "Account Responsibilities",
          details:
            "To access certain features, you must create an account. You agree to: provide accurate, current information during registration; maintain the security of your password and account; notify us immediately of any unauthorized access; and accept responsibility for all activity under your account. We reserve the right to suspend or terminate accounts that violate these Terms or remain inactive for extended periods.",
        },
      ],
    },
    {
      id: "user-content",
      icon: Database,
      title: "4. User Content",
      content: [
        {
          subtitle: "Your Content Rights",
          details:
            "You retain ownership of content you submit (session logs, reviews, photos, comments). By posting content, you grant Quiver a worldwide, non-exclusive, royalty-free license to use, display, reproduce, and distribute your content in connection with the Service.",
        },
        {
          subtitle: "Content Restrictions",
          details:
            "You agree not to post content that: is false, misleading, or defamatory; infringes intellectual property rights; contains harassment, hate speech, or threats; is spam or commercial solicitation; or violates any applicable law. We may remove content that violates these Terms without notice.",
        },
      ],
    },
    {
      id: "forecast-disclaimer",
      icon: Waves,
      title: "5. Surf Forecast Disclaimer",
      content: [
        {
          subtitle: "IMPORTANT NOTICE",
          details:
            "QUIVER PROVIDES SURF FORECASTS, WAVE PREDICTIONS, AND OCEAN CONDITION INFORMATION FOR GENERAL INFORMATIONAL PURPOSES ONLY. THIS INFORMATION IS NOT A SUBSTITUTE FOR YOUR OWN JUDGMENT, LOCAL KNOWLEDGE, OR PROFESSIONAL INSTRUCTION.",
        },
        {
          subtitle: "Your Acknowledgment",
          details:
            "You acknowledge and agree that: ocean conditions are inherently unpredictable and can change rapidly; forecasts are predictions based on available data and may be inaccurate; local conditions may differ significantly from forecasted conditions; you are solely responsible for assessing conditions before entering the water; and Quiver does not guarantee the accuracy, completeness, or timeliness of any forecast.",
        },
      ],
    },
    {
      id: "assumption-of-risk",
      icon: Shield,
      title: "6. Assumption of Risk",
      content: [
        {
          subtitle: "INHERENT DANGERS",
          details:
            "SURFING AND OCEAN ACTIVITIES ARE INHERENTLY DANGEROUS AND CAN RESULT IN SERIOUS INJURY OR DEATH. By using Quiver, you acknowledge that you understand these risks and voluntarily assume full responsibility for any injury, loss, or damage that may occur.",
        },
        {
          subtitle: "Specific Risks",
          details:
            "Risks include but are not limited to: drowning; collisions with other surfers, watercraft, or marine life; impact with the ocean floor, rocks, or reef; dangerous currents, rip tides, and shore break; hypothermia and sun exposure; and equipment failure. Quiver does not assess your skill level, physical condition, or ability to handle specific conditions. You are solely responsible for making safe decisions.",
        },
      ],
    },
    {
      id: "limitation-of-liability",
      icon: Lock,
      title: "7. Limitation of Liability",
      content: [
        {
          subtitle: "Liability Cap",
          details:
            "TO THE MAXIMUM EXTENT PERMITTED BY LAW, QUIVER AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO PERSONAL INJURY, DEATH, PROPERTY DAMAGE, LOSS OF DATA, OR LOSS OF PROFITS, ARISING FROM YOUR USE OF THE SERVICE.",
        },
        {
          subtitle: "Maximum Damages",
          details:
            "IN NO EVENT SHALL QUIVER'S TOTAL LIABILITY EXCEED THE AMOUNT YOU PAID TO QUIVER IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM, OR ONE HUNDRED DOLLARS ($100), WHICHEVER IS GREATER. Some jurisdictions do not allow limitation of liability for personal injury or death. In such jurisdictions, our liability is limited to the maximum extent permitted by law.",
        },
      ],
    },
    {
      id: "indemnification",
      icon: Shield,
      title: "8. Indemnification",
      content: [
        {
          subtitle: "Your Agreement to Indemnify",
          details:
            "You agree to indemnify and hold harmless Quiver and its affiliates from any claims, damages, losses, or expenses (including legal fees) arising from your use of the Service, your content, or your violation of these Terms.",
        },
      ],
    },
    {
      id: "acceptable-use",
      icon: Target,
      title: "9. Acceptable Use",
      content: [
        {
          subtitle: "Prohibited Activities",
          details:
            "You agree not to: use the Service for any illegal purpose; attempt to gain unauthorized access to any part of the Service; interfere with or disrupt the Service or servers; scrape, crawl, or collect data without permission; impersonate others or misrepresent your affiliation; use automated systems to access the Service without permission; or reverse engineer or attempt to extract source code.",
        },
      ],
    },
    {
      id: "intellectual-property",
      icon: Globe,
      title: "10. Intellectual Property",
      content: [
        {
          subtitle: "Ownership",
          details:
            "The Service, including its design, features, content, and trademarks, is owned by Quiver and protected by intellectual property laws. You may not copy, modify, distribute, or create derivative works without our written permission.",
        },
      ],
    },
    {
      id: "third-party-services",
      icon: Globe,
      title: "11. Third-Party Services",
      content: [
        {
          subtitle: "External Services",
          details:
            "Quiver integrates with third-party services for maps, weather data, and other features. Your use of these services is subject to their respective terms and privacy policies. Quiver is not responsible for third-party content or services.",
        },
      ],
    },
    {
      id: "termination",
      icon: Trash2,
      title: "12. Termination",
      content: [
        {
          subtitle: "Account Termination",
          details:
            "We may suspend or terminate your access to the Service at any time, with or without cause, with or without notice. Upon termination, your right to use the Service ceases immediately. Provisions that by their nature should survive termination (including disclaimers, limitations of liability, and indemnification) shall survive.",
        },
      ],
    },
    {
      id: "arbitration",
      icon: Settings,
      title: "13. Dispute Resolution and Arbitration",
      content: [
        {
          subtitle: "PLEASE READ CAREFULLY",
          details:
            "THIS SECTION AFFECTS YOUR LEGAL RIGHTS, INCLUDING YOUR RIGHT TO FILE A LAWSUIT IN COURT.",
        },
        {
          subtitle: "Agreement to Arbitrate",
          details:
            "You and Quiver agree that any dispute, claim, or controversy arising out of or relating to these Terms or the Service (collectively, \"Disputes\") will be resolved by binding individual arbitration rather than in court, except that either party may bring individual claims in small claims court if they qualify.",
        },
        {
          subtitle: "Class Action Waiver",
          details:
            "YOU AND QUIVER AGREE THAT EACH MAY BRING CLAIMS AGAINST THE OTHER ONLY IN YOUR OR ITS INDIVIDUAL CAPACITY, AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS, COLLECTIVE, OR REPRESENTATIVE PROCEEDING. Unless both you and Quiver agree otherwise, the arbitrator may not consolidate or join more than one person's claims and may not preside over any form of a representative, class, or collective proceeding.",
        },
        {
          subtitle: "Arbitration Rules",
          details:
            "The arbitration will be administered by JAMS under its Streamlined Arbitration Rules and Procedures, or as otherwise agreed by the parties. The arbitration will be conducted in the English language in the county where you reside or another mutually agreed location.",
        },
        {
          subtitle: "Opt-Out Right",
          details:
            "You may opt out of this arbitration agreement by sending written notice to legal@quiversurf.com within 30 days of creating your account. If you opt out, you and Quiver may still resolve Disputes in small claims court or through litigation in accordance with Section 14.",
        },
        {
          subtitle: "Severability",
          details:
            "If any part of this arbitration agreement is found unenforceable, the remaining portions shall remain in effect. If the class action waiver is found unenforceable for a particular claim, then the entire arbitration agreement shall be null and void for that claim only, and the Dispute shall proceed in court.",
        },
      ],
    },
    {
      id: "governing-law",
      icon: Globe,
      title: "14. Governing Law",
      content: [
        {
          subtitle: "Applicable Law",
          details:
            "These Terms are governed by the laws of the State of California, United States, without regard to conflict of law principles. For any Disputes not subject to arbitration, you agree to submit to the personal and exclusive jurisdiction of the state and federal courts located in California.",
        },
      ],
    },
    {
      id: "changes",
      icon: Settings,
      title: "15. Changes to Terms",
      content: [
        {
          subtitle: "Updates",
          details:
            "We may update these Terms from time to time. We will notify you of material changes by posting the new Terms and updating the \"Last Updated\" date. Your continued use after changes constitutes acceptance of the revised Terms.",
        },
      ],
    },
  ],
  contact: {
    title: "Contact Information",
    description:
      "If you have any questions about these Terms, please contact us:",
    methods: [
      {
        type: "Email",
        value: "legal@quiversurf.com",
      },
      {
        type: "Website",
        value: "quiversurf.com",
      },
      {
        type: "Postal Address",
        value:
          "Quiver Surf Technologies, 2261 Market Street STE 10852, San Francisco, CA 94114, Attn: Legal",
      },
    ],
  },
} as const;
```

**Step 2: Verify TypeScript compiles**

Run: `yarn tsc --noEmit 2>&1 | head -20`
Expected: No errors related to content.ts

**Step 3: Commit**

```bash
git add lib/constants/content.ts
git commit -m "feat(terms): add TERMS_CONTENT constant with all sections"
```

---

## Task 2: Create Terms of Service Page

**Files:**
- Create: `app/terms/page.tsx`

**Step 1: Create the Terms page**

Create `app/terms/page.tsx`:

```tsx
import { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TERMS_CONTENT } from "@/lib/constants/content";

export const metadata: Metadata = {
  title: "Terms of Service | Quiver - Surf Community Platform",
  description:
    "Read Quiver's Terms of Service. Understand the rules, guidelines, and legal agreements for using our surf forecasting and community platform.",
  keywords: [
    "terms of service",
    "terms and conditions",
    "user agreement",
    "surf app terms",
    "legal",
  ],
  openGraph: {
    title: "Terms of Service | Quiver - Surf Community Platform",
    description:
      "Terms of Service for Quiver surf platform. Know your rights and responsibilities.",
    type: "website",
  },
};

export default function TermsPage() {
  const { hero, overview, sections, contact } = TERMS_CONTENT;

  return (
    <div className="min-h-screen bg-gradient-to-br from-sandy-beige via-white to-blue-50">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link
              href="/"
              className="text-2xl font-roboto font-bold text-dark-grey"
            >
              Quiver
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/auth/sign-in"
                className="text-dark-grey hover:text-ocean-blue transition-colors"
              >
                Sign In
              </Link>
              <Button asChild className="bg-ocean-blue hover:bg-ocean-blue/90">
                <Link href="/auth/sign-up">Get Started</Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-roboto font-bold text-dark-grey mb-6">
            {hero.title}
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 mb-8 font-open-sans">
            {hero.subtitle}
          </p>
          <div className="space-y-2">
            <Badge variant="outline" className="text-sm font-medium">
              Last Updated: {hero.lastUpdated}
            </Badge>
            <p className="text-sm text-gray-500 font-open-sans">
              {hero.effectiveDate}
            </p>
          </div>
        </div>
      </section>

      {/* Overview Section */}
      <section className="py-12 px-4 bg-white/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-roboto font-bold text-dark-grey mb-6 text-center">
            {overview.title}
          </h2>
          <p className="text-lg text-gray-600 font-open-sans leading-relaxed text-center">
            {overview.description}
          </p>
        </div>
      </section>

      {/* Terms Sections */}
      <section className="py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="space-y-16">
            {sections.map((section) => (
              <div key={section.id} id={section.id}>
                <Card className="hover:shadow-lg transition-shadow duration-300 bg-white/80 backdrop-blur-sm">
                  <CardHeader>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 bg-ocean-blue/10 rounded-full flex items-center justify-center">
                        <section.icon className="h-6 w-6 text-ocean-blue" />
                      </div>
                      <h2 className="text-2xl md:text-3xl font-roboto font-bold text-dark-grey">
                        {section.title}
                      </h2>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {section.content.map((item, itemIndex) => (
                        <div key={itemIndex}>
                          <h3 className="text-lg font-roboto font-semibold text-dark-grey mb-3">
                            {item.subtitle}
                          </h3>
                          <p className="text-gray-600 font-open-sans leading-relaxed">
                            {item.details}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quick Navigation */}
      <section className="py-12 px-4 bg-white/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-roboto font-bold text-dark-grey mb-8 text-center">
            Quick Navigation
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sections.map((section) => (
              <Link
                key={section.id}
                href={`#${section.id}`}
                className="flex items-center gap-3 p-4 bg-white/80 backdrop-blur-sm rounded-lg hover:shadow-md transition-shadow duration-300 group"
              >
                <section.icon className="h-5 w-5 text-ocean-blue group-hover:text-ocean-blue/80" />
                <span className="text-dark-grey font-open-sans group-hover:text-ocean-blue transition-colors text-sm">
                  {section.title}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-ocean-blue to-blue-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-roboto font-bold text-white mb-6">
            {contact.title}
          </h2>
          <p className="text-xl text-white/90 mb-8 font-open-sans">
            {contact.description}
          </p>

          <div className="space-y-4 text-white/90 font-open-sans max-w-2xl mx-auto mb-8">
            {contact.methods.map((method, index) => (
              <div key={index} className="text-center">
                <p>
                  <strong>{method.type}:</strong> {method.value}
                </p>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              size="lg"
              className="bg-white text-ocean-blue hover:bg-gray-50 px-8 py-4 text-lg font-roboto font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
              asChild
            >
              <Link href="mailto:legal@quiversurf.com">
                <Mail className="mr-2 h-5 w-5" />
                Contact Legal Team
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-dark-grey text-white py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-2">
              <h3 className="text-2xl font-roboto font-bold mb-4">Quiver</h3>
              <p className="font-open-sans text-gray-300 mb-4 max-w-md">
                The ultimate social platform for surfers. Connect with your
                community, plan sessions, and share the stoke.
              </p>
            </div>
            <div>
              <h4 className="font-roboto font-semibold mb-4">Product</h4>
              <ul className="space-y-2 font-open-sans text-gray-300">
                <li>
                  <Link
                    href="/features"
                    className="hover:text-white transition-colors"
                  >
                    Features
                  </Link>
                </li>
                <li>
                  <Link
                    href="/map"
                    className="hover:text-white transition-colors"
                  >
                    Explore Spots
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-roboto font-semibold mb-4">Company</h4>
              <ul className="space-y-2 font-open-sans text-gray-300">
                <li>
                  <Link
                    href="/about"
                    className="hover:text-white transition-colors"
                  >
                    About
                  </Link>
                </li>
                <li>
                  <Link
                    href="mailto:support@quiversurf.app"
                    className="hover:text-white transition-colors"
                  >
                    Contact
                  </Link>
                </li>
                <li>
                  <Link
                    href="/privacy"
                    className="hover:text-white transition-colors"
                  >
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link
                    href="/terms"
                    className="hover:text-white transition-colors"
                  >
                    Terms
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-600 pt-8 text-center">
            <p className="font-open-sans text-gray-300 text-sm">
              © 2026 Quiver. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
```

**Step 2: Verify page builds**

Run: `yarn build 2>&1 | grep -E "(terms|error|Error)" | head -10`
Expected: No build errors, terms page compiles

**Step 3: Commit**

```bash
git add app/terms/page.tsx
git commit -m "feat(terms): add Terms of Service page"
```

---

## Task 3: Update Footer Links

**Files:**
- Modify: `components/landing-page/footer-section.tsx:22`

**Step 1: Update the Terms of Service link**

Change line 22 from:
```typescript
    { name: "Terms of Service", href: "#" },
```

To:
```typescript
    { name: "Terms of Service", href: "/terms" },
```

**Step 2: Verify the change**

Run: `grep -n "Terms of Service" components/landing-page/footer-section.tsx`
Expected: Shows `{ name: "Terms of Service", href: "/terms" },`

**Step 3: Commit**

```bash
git add components/landing-page/footer-section.tsx
git commit -m "fix(footer): update Terms of Service link to /terms"
```

---

## Task 4: Add Consent Checkbox State to Auth Modal

**Files:**
- Modify: `components/auth/unified-auth-modal.tsx`

**Step 1: Add termsAccepted state variable**

After line 121 (`const [displayName, setDisplayName] = useState("");`), add:

```typescript
  const [termsAccepted, setTermsAccepted] = useState(false);
```

**Step 2: Reset termsAccepted when modal closes**

In the useEffect that resets form (around line 232-242), add `setTermsAccepted(false);` after `setDisplayName("");`:

```typescript
  useEffect(() => {
    if (!isOpen) {
      setView(initialView);
      setActiveMode(initialMode);
      setEmail("");
      setPassword("");
      setDisplayName("");
      setTermsAccepted(false);
      setError(null);
      setLoading(false);
    }
  }, [isOpen, initialView, initialMode]);
```

**Step 3: Verify TypeScript compiles**

Run: `yarn tsc --noEmit 2>&1 | grep -i "unified-auth"`
Expected: No errors

**Step 4: Commit**

```bash
git add components/auth/unified-auth-modal.tsx
git commit -m "feat(auth): add termsAccepted state to auth modal"
```

---

## Task 5: Add Consent Checkbox UI Component

**Files:**
- Modify: `components/auth/unified-auth-modal.tsx`

**Step 1: Add Checkbox import**

At the top of the file, add to the imports from `@/components/ui/checkbox`:

```typescript
import { Checkbox } from "@/components/ui/checkbox";
```

**Step 2: Create TermsCheckbox component**

Add this component before the `UnifiedAuthModal` function (around line 90):

```typescript
/**
 * Terms and Privacy consent checkbox
 */
interface TermsCheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

function TermsCheckbox({ checked, onCheckedChange, disabled }: TermsCheckboxProps) {
  return (
    <div className="flex items-start space-x-2">
      <Checkbox
        id="terms-consent"
        checked={checked}
        onCheckedChange={(checked) => onCheckedChange(checked === true)}
        disabled={disabled}
        className="mt-1"
      />
      <label
        htmlFor="terms-consent"
        className="text-sm text-muted-foreground leading-relaxed cursor-pointer"
      >
        I agree to the{" "}
        <a
          href="/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Terms of Service
        </a>{" "}
        and{" "}
        <a
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Privacy Policy
        </a>
      </label>
    </div>
  );
}
```

**Step 3: Verify TypeScript compiles**

Run: `yarn tsc --noEmit 2>&1 | grep -i "unified-auth"`
Expected: No errors

**Step 4: Commit**

```bash
git add components/auth/unified-auth-modal.tsx
git commit -m "feat(auth): add TermsCheckbox component"
```

---

## Task 6: Add Checkbox to Email/Password Form

**Files:**
- Modify: `components/auth/unified-auth-modal.tsx`

**Step 1: Update EmailPasswordFormProps interface**

Add these props to the interface (around line 624):

```typescript
interface EmailPasswordFormProps {
  mode: "login" | "signup" | "auto";
  email: string;
  password: string;
  displayName: string;
  termsAccepted: boolean;
  loading: boolean;
  emailInputRef: React.RefObject<HTMLInputElement>;
  onEmailChange: (email: string) => void;
  onPasswordChange: (password: string) => void;
  onDisplayNameChange: (name: string) => void;
  onTermsAcceptedChange: (accepted: boolean) => void;
  onSubmit: () => void;
  onBack: () => void;
}
```

**Step 2: Update EmailPasswordForm function signature**

Update the function to include new props:

```typescript
function EmailPasswordForm({
  mode,
  email,
  password,
  displayName,
  termsAccepted,
  loading,
  emailInputRef,
  onEmailChange,
  onPasswordChange,
  onDisplayNameChange,
  onTermsAcceptedChange,
  onSubmit,
  onBack,
}: EmailPasswordFormProps) {
```

**Step 3: Add checkbox and update button in EmailPasswordForm**

After the password field div (around line 693), before the submit Button, add:

```typescript
      {mode === "signup" && (
        <TermsCheckbox
          checked={termsAccepted}
          onCheckedChange={onTermsAcceptedChange}
          disabled={loading}
        />
      )}
```

Update the submit Button to be disabled when terms not accepted during signup:

```typescript
      <Button
        onClick={onSubmit}
        className="w-full"
        size="lg"
        disabled={loading || (mode === "signup" && !termsAccepted)}
      >
```

**Step 4: Update the EmailPasswordForm call in renderContent**

Find where EmailPasswordForm is rendered (around line 427) and add the new props:

```typescript
        return (
          <EmailPasswordForm
            mode={activeMode}
            email={email}
            password={password}
            displayName={displayName}
            termsAccepted={termsAccepted}
            loading={loading}
            emailInputRef={emailInputRef}
            onEmailChange={setEmail}
            onPasswordChange={setPassword}
            onDisplayNameChange={setDisplayName}
            onTermsAcceptedChange={setTermsAccepted}
            onSubmit={handleEmailPassword}
            onBack={handleBack}
          />
        );
```

**Step 5: Verify TypeScript compiles**

Run: `yarn tsc --noEmit 2>&1 | grep -i "unified-auth"`
Expected: No errors

**Step 6: Commit**

```bash
git add components/auth/unified-auth-modal.tsx
git commit -m "feat(auth): add terms checkbox to email/password signup form"
```

---

## Task 7: Add Checkbox to OAuth Provider View

**Files:**
- Modify: `components/auth/unified-auth-modal.tsx`

**Step 1: Update AuthProvidersProps interface**

Add terms props to the interface (around line 541):

```typescript
interface AuthProvidersProps {
  mode: "login" | "signup" | "auto";
  enableOAuth: boolean;
  enablePassword: boolean;
  enableMagicLink: boolean;
  termsAccepted: boolean;
  loading: boolean;
  onGoogleClick: () => void;
  onEmailPasswordClick: () => void;
  onMagicLinkClick: () => void;
  onTermsAcceptedChange: (accepted: boolean) => void;
}
```

**Step 2: Update AuthProviders function**

Update the function signature and add checkbox before OAuth button:

```typescript
function AuthProviders({
  mode,
  enableOAuth,
  enablePassword,
  enableMagicLink,
  termsAccepted,
  loading,
  onGoogleClick,
  onEmailPasswordClick,
  onMagicLinkClick,
  onTermsAcceptedChange,
}: AuthProvidersProps) {
  return (
    <div className="grid gap-3 pt-2">
      {mode === "signup" && (
        <TermsCheckbox
          checked={termsAccepted}
          onCheckedChange={onTermsAcceptedChange}
          disabled={loading}
        />
      )}

      {enableOAuth && (
        <Button
          onClick={onGoogleClick}
          className="w-full"
          size="lg"
          variant="default"
          disabled={loading || (mode === "signup" && !termsAccepted)}
        >
```

**Step 3: Update the AuthProviders call in renderContent**

Find where AuthProviders is rendered (around line 413) and add the new props:

```typescript
        return (
          <AuthProviders
            mode={activeMode}
            enableOAuth={enableOAuth}
            enablePassword={enablePassword}
            enableMagicLink={enableMagicLink}
            termsAccepted={termsAccepted}
            loading={loading}
            onGoogleClick={handleGoogleOAuth}
            onEmailPasswordClick={() => setView("email-password")}
            onMagicLinkClick={() => setView("magic-link")}
            onTermsAcceptedChange={setTermsAccepted}
          />
        );
```

**Step 4: Verify TypeScript compiles**

Run: `yarn tsc --noEmit 2>&1 | grep -i "unified-auth"`
Expected: No errors

**Step 5: Commit**

```bash
git add components/auth/unified-auth-modal.tsx
git commit -m "feat(auth): add terms checkbox to OAuth signup view"
```

---

## Task 8: Pass Consent Metadata to Signup

**Files:**
- Modify: `components/auth/unified-auth-modal.tsx`

**Step 1: Update buildSignupMetadata function**

Find the buildSignupMetadata function (around line 137) and add terms consent:

```typescript
  const buildSignupMetadata = (method: "email" | "google") => {
    const attribution = getAttributionFromCookies();
    const ipLocation = locationContext?.ipLocation;
    const now = new Date().toISOString();
    const termsVersion = "2026-01-25";

    // ... existing code ...

    return {
      signup_context: {
        // ... existing fields ...
      },
      location_data: ipLocation
        ? {
            // ... existing fields ...
          }
        : null,
      legal_consent: {
        terms_accepted_at: now,
        terms_version: termsVersion,
        privacy_accepted_at: now,
      },
    };
  };
```

The full updated function:

```typescript
  const buildSignupMetadata = (method: "email" | "google") => {
    const attribution = getAttributionFromCookies();
    const ipLocation = locationContext?.ipLocation;
    const now = new Date().toISOString();
    const termsVersion = "2026-01-25";

    // Strip query params from referrer to avoid leaking sensitive URLs
    let referrer = "direct";
    if (typeof document !== "undefined" && document.referrer) {
      try {
        const url = new URL(document.referrer);
        referrer = url.origin + url.pathname;
      } catch {
        referrer = "unknown";
      }
    }

    // Detect device type using modern API with UA fallback
    let deviceKind: "mobile" | "desktop" = "desktop";
    if (typeof navigator !== "undefined") {
      if ("userAgentData" in navigator && (navigator as any).userAgentData?.mobile) {
        deviceKind = "mobile";
      } else if (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        deviceKind = "mobile";
      }
    }

    return {
      signup_context: {
        method,
        entrypoint: source,
        landing_path:
          typeof window !== "undefined" ? window.location.pathname : "/",
        referrer,
        utm: {
          source: attribution.utm_source,
          medium: attribution.utm_medium,
          campaign: attribution.utm_campaign,
          content: attribution.utm_content,
          term: attribution.utm_term,
        },
        tz:
          typeof Intl !== "undefined"
            ? Intl.DateTimeFormat().resolvedOptions().timeZone
            : null,
        locale: typeof navigator !== "undefined" ? navigator.language : null,
        device: {
          kind: deviceKind,
        },
        captured_at: now,
      },
      location_data: ipLocation
        ? {
            source: "ip",
            city: ipLocation.city,
            region: ipLocation.region,
            country: ipLocation.country,
            latitude: ipLocation.latitude,
            longitude: ipLocation.longitude,
          }
        : null,
      legal_consent: {
        terms_accepted_at: now,
        terms_version: termsVersion,
        privacy_accepted_at: now,
      },
    };
  };
```

**Step 2: Verify TypeScript compiles**

Run: `yarn tsc --noEmit 2>&1 | grep -i "unified-auth"`
Expected: No errors

**Step 3: Commit**

```bash
git add components/auth/unified-auth-modal.tsx
git commit -m "feat(auth): include legal consent timestamps in signup metadata"
```

---

## Task 9: Write Unit Tests

**Files:**
- Create: `__tests__/components/auth/unified-auth-modal.terms.test.tsx`

**Step 1: Create test file**

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";

// Mock dependencies
jest.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    signIn: jest.fn(),
    signUp: jest.fn(),
  }),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/",
}));

jest.mock("@/context/location-context", () => ({
  useLocationSafe: () => null,
}));

jest.mock("@/lib/attribution", () => ({
  getAttributionFromCookies: () => ({}),
}));

jest.mock("@/lib/auth/auth-utils", () => ({
  initiateOAuthFlow: jest.fn(),
  sendMagicLink: jest.fn(),
  validateEmail: (email: string) => email.includes("@"),
  validatePassword: () => ({ valid: true }),
  getAuthRedirect: () => null,
  setAuthRedirect: jest.fn(),
  clearAuthRedirect: jest.fn(),
}));

jest.mock("@/lib/analytics/auth-events", () => ({
  trackAuthModalOpened: jest.fn(),
  trackAuthMethodSelected: jest.fn(),
  trackLoginStarted: jest.fn(),
  trackLoginSuccess: jest.fn(),
  trackLoginFailed: jest.fn(),
  trackSignupStarted: jest.fn(),
  trackSignupSuccess: jest.fn(),
  trackSignupFailed: jest.fn(),
  trackMagicLinkSent: jest.fn(),
  categorizeAuthError: jest.fn(),
  extractEmailDomain: jest.fn(),
}));

describe("UnifiedAuthModal Terms Consent", () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    mode: "signup" as const,
    source: "test",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows terms checkbox in signup mode on providers view", () => {
    render(<UnifiedAuthModal {...defaultProps} />);

    expect(screen.getByText(/I agree to the/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Terms of Service/i })).toHaveAttribute(
      "href",
      "/terms"
    );
    expect(screen.getByRole("link", { name: /Privacy Policy/i })).toHaveAttribute(
      "href",
      "/privacy"
    );
  });

  it("does not show terms checkbox in login mode", () => {
    render(<UnifiedAuthModal {...defaultProps} mode="login" />);

    expect(screen.queryByText(/I agree to the/)).not.toBeInTheDocument();
  });

  it("disables Google OAuth button until terms accepted in signup mode", () => {
    render(<UnifiedAuthModal {...defaultProps} />);

    const googleButton = screen.getByRole("button", { name: /Continue with Google/i });
    expect(googleButton).toBeDisabled();

    // Check the terms checkbox
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    expect(googleButton).not.toBeDisabled();
  });

  it("shows terms checkbox on email/password form in signup mode", () => {
    render(<UnifiedAuthModal {...defaultProps} />);

    // Click email option
    const emailButton = screen.getByRole("button", { name: /Continue with Email/i });
    fireEvent.click(emailButton);

    // Should still show terms checkbox
    expect(screen.getByText(/I agree to the/)).toBeInTheDocument();
  });

  it("disables signup button until terms accepted on email form", () => {
    render(<UnifiedAuthModal {...defaultProps} />);

    // Accept terms first to enable email button
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    // Click email option
    const emailButton = screen.getByRole("button", { name: /Continue with Email/i });
    fireEvent.click(emailButton);

    // Signup button should be disabled until terms checked (checkbox resets per view)
    const signupButton = screen.getByRole("button", { name: /Sign up/i });

    // Fill in required fields
    fireEvent.change(screen.getByLabelText(/Your Name/i), {
      target: { value: "Test User" },
    });
    fireEvent.change(screen.getByLabelText(/Email/i), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: "password123" },
    });

    // Check terms again on this view
    const emailFormCheckbox = screen.getByRole("checkbox");
    expect(signupButton).toBeDisabled();

    fireEvent.click(emailFormCheckbox);
    expect(signupButton).not.toBeDisabled();
  });

  it("opens terms link in new tab", () => {
    render(<UnifiedAuthModal {...defaultProps} />);

    const termsLink = screen.getByRole("link", { name: /Terms of Service/i });
    expect(termsLink).toHaveAttribute("target", "_blank");
    expect(termsLink).toHaveAttribute("rel", "noopener noreferrer");
  });
});
```

**Step 2: Run the tests**

Run: `yarn test:unit __tests__/components/auth/unified-auth-modal.terms.test.tsx`
Expected: All tests pass

**Step 3: Commit**

```bash
git add __tests__/components/auth/unified-auth-modal.terms.test.tsx
git commit -m "test(auth): add unit tests for terms consent checkbox"
```

---

## Task 10: Run Full Test Suite and Verify

**Files:**
- None (verification only)

**Step 1: Run TypeScript check**

Run: `yarn tsc --noEmit`
Expected: No errors

**Step 2: Run unit tests**

Run: `yarn test:unit --passWithNoTests`
Expected: All tests pass

**Step 3: Run build**

Run: `yarn build`
Expected: Build succeeds, /terms page included

**Step 4: Manual verification (optional)**

Run: `yarn dev`
Navigate to:
- `/terms` - verify page loads with all sections
- `/auth/sign-up` - verify checkbox appears and disables buttons until checked
- Click "Continue with Email" - verify checkbox appears on that form too

**Step 5: Final commit if any fixes needed**

If all passes, no additional commit needed.

---

## Summary

**Total Tasks:** 10
**Estimated Time:** 45-60 minutes

**Files Created:**
- `app/terms/page.tsx`
- `__tests__/components/auth/unified-auth-modal.terms.test.tsx`

**Files Modified:**
- `lib/constants/content.ts` (add TERMS_CONTENT)
- `components/landing-page/footer-section.tsx` (update link)
- `components/auth/unified-auth-modal.tsx` (add checkbox, consent metadata)

**Commits:** 9 commits following TDD approach
