# Accessibility Testing Guide

## Overview

Quiver implements comprehensive accessibility testing to ensure WCAG 2.1 AA compliance across the platform. This guide covers our accessibility infrastructure, testing strategies, and best practices.

## Testing Infrastructure

### Tools & Libraries

1. **@axe-core/playwright** - Automated accessibility testing in E2E tests
2. **jest-axe** - Component-level accessibility testing in unit tests
3. **eslint-plugin-jsx-a11y** - Static analysis for accessibility issues during development
4. **Lighthouse CI** - Automated accessibility audits in CI/CD pipeline

### Installation

All accessibility tools are included in `devDependencies`:

```bash
npm install
```

## Running Accessibility Tests

### E2E Accessibility Tests

Run the complete accessibility test suite:

```bash
npm run test:e2e:a11y
```

Run with UI mode for debugging:

```bash
npm run test:e2e:ui -- e2e/accessibility.spec.ts
```

### Component Accessibility Tests

Run Jest tests with accessibility checks:

```bash
npm test
```

### Linting for Accessibility

Check for accessibility issues during development:

```bash
npm run lint
```

### Lighthouse CI Audits

Run Lighthouse with accessibility thresholds:

```bash
npm run lighthouse:ci
```

## Test Coverage

### Critical Pages Tested

- ✅ Landing page
- ✅ Discover page
- ✅ Map view
- ✅ Sign-in/Sign-up forms
- ✅ Profile page (authenticated)
- ✅ Session planning (authenticated)

### Accessibility Checks

Our automated tests verify:

1. **Color Contrast** - Text must meet WCAG AA contrast ratios (4.5:1 for normal text, 3:1 for large text)
2. **ARIA Attributes** - Proper use of ARIA roles, states, and properties
3. **Form Labels** - All form inputs have associated labels
4. **Keyboard Navigation** - All interactive elements are keyboard accessible
5. **Semantic HTML** - Proper heading hierarchy and landmark regions
6. **Screen Reader Support** - Alt text for images, descriptive link text
7. **Focus Management** - Visible focus indicators and logical tab order

## Writing Accessibility Tests

### E2E Test Pattern

```typescript
test("Page should not have accessibility violations", async ({ page }) => {
  await page.goto("/your-page");
  await page.waitForLoadState("load");

  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(accessibilityScanResults.violations).toEqual([]);
});
```

### Component Test Pattern

```typescript
import { axe, toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

test("Component should be accessible", async () => {
  const { container } = render(<YourComponent />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

## Accessibility Standards

### WCAG 2.1 AA Requirements

We target WCAG 2.1 Level AA compliance, which includes:

#### Perceivable

- **1.1.1** Non-text Content (Level A)
- **1.3.1** Info and Relationships (Level A)
- **1.4.3** Contrast (Minimum) (Level AA) - 4.5:1 ratio
- **1.4.11** Non-text Contrast (Level AA) - 3:1 ratio

#### Operable

- **2.1.1** Keyboard (Level A) - All functionality via keyboard
- **2.1.2** No Keyboard Trap (Level A)
- **2.4.3** Focus Order (Level A)
- **2.4.7** Focus Visible (Level AA)

#### Understandable

- **3.1.1** Language of Page (Level A)
- **3.2.1** On Focus (Level A)
- **3.3.1** Error Identification (Level A)
- **3.3.2** Labels or Instructions (Level A)

#### Robust

- **4.1.1** Parsing (Level A)
- **4.1.2** Name, Role, Value (Level A)
- **4.1.3** Status Messages (Level AA)

## Common Accessibility Patterns

### Buttons

```tsx
// ✅ Good - Accessible button
<button type="button" aria-label="Close dialog">
  <X aria-hidden="true" />
</button>

// ❌ Bad - Missing accessible name
<button type="button">
  <X />
</button>
```

### Forms

```tsx
// ✅ Good - Proper label association
<label htmlFor="email">Email</label>
<input id="email" type="email" aria-required="true" />

// ❌ Bad - No label association
<input type="email" placeholder="Email" />
```

### Images

```tsx
// ✅ Good - Descriptive alt text
<img src="/beach.jpg" alt="Ocean Beach at sunset with surfers" />

// ✅ Good - Decorative image
<img src="/pattern.svg" alt="" role="presentation" />

// ❌ Bad - Missing alt attribute
<img src="/beach.jpg" />
```

### Links

```tsx
// ✅ Good - Descriptive link text
<Link href="/forecast">View detailed forecast for Ocean Beach</Link>

// ❌ Bad - Generic link text
<Link href="/forecast">Click here</Link>
```

### Headings

```tsx
// ✅ Good - Proper hierarchy
<h1>Quiver Surf App</h1>
<h2>Today's Forecast</h2>
<h3>Wave Height</h3>

// ❌ Bad - Skipping levels
<h1>Quiver Surf App</h1>
<h3>Wave Height</h3> {/* Missing h2 */}
```

### ARIA Live Regions

```tsx
// ✅ Good - Status updates
<div role="status" aria-live="polite">
  Session saved successfully
</div>

// ✅ Good - Error alerts
<div role="alert" aria-live="assertive">
  Please fix the following errors
</div>
```

## CI/CD Integration

### Lighthouse CI Configuration

The `.lighthouserc.json` enforces accessibility standards:

```json
{
  "assert": {
    "assertions": {
      "categories:accessibility": ["error", { "minScore": 0.9 }]
    }
  }
}
```

Builds will fail if accessibility score drops below 90%.

### GitHub Actions (Future)

```yaml
- name: Run Accessibility Tests
  run: npm run test:e2e:a11y

- name: Run Lighthouse CI
  run: npm run lighthouse:ci
```

## Manual Testing Checklist

In addition to automated tests, perform manual accessibility testing:

### Keyboard Navigation

- [ ] Tab through all interactive elements
- [ ] Verify logical tab order
- [ ] Check focus visibility on all elements
- [ ] Test Escape key closes modals
- [ ] Test Enter/Space activates buttons

### Screen Reader Testing

- [ ] Test with VoiceOver (macOS)
- [ ] Test with NVDA (Windows)
- [ ] Verify all images have proper alt text
- [ ] Check form labels are announced
- [ ] Verify live region announcements

### Visual Testing

- [ ] Test with browser zoom at 200%
- [ ] Verify color contrast meets standards
- [ ] Check focus indicators are visible
- [ ] Test with reduced motion preference
- [ ] Test in high contrast mode

### Mobile Testing

- [ ] Test with mobile screen readers
- [ ] Verify touch targets are ≥44px
- [ ] Check pinch-to-zoom works
- [ ] Test in portrait and landscape

## Resources

### Official Documentation

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Axe-core Rules](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)

### Tools

- [axe DevTools Browser Extension](https://www.deque.com/axe/devtools/)
- [WAVE Browser Extension](https://wave.webaim.org/extension/)
- [Lighthouse in Chrome DevTools](https://developer.chrome.com/docs/lighthouse/)

### Testing Tools

- [VoiceOver (macOS)](https://www.apple.com/accessibility/voiceover/)
- [NVDA (Windows)](https://www.nvaccess.org/)
- [JAWS (Windows)](https://www.freedomscientific.com/products/software/jaws/)

## Troubleshooting

### Common Issues

#### Contrast Violations

```tsx
// ❌ Bad - Low contrast
<p className="text-gray-400 bg-gray-100">Text</p>

// ✅ Good - Sufficient contrast
<p className="text-gray-900 bg-white">Text</p>
```

#### Missing ARIA Labels

```tsx
// ❌ Bad - Icon button without label
<button><SearchIcon /></button>

// ✅ Good - Descriptive label
<button aria-label="Search beaches"><SearchIcon aria-hidden="true" /></button>
```

#### Form Errors Not Announced

```tsx
// ❌ Bad - Error not announced
{
  error && <p className="text-red-500">{error}</p>;
}

// ✅ Good - Error announced to screen readers
{
  error && (
    <p role="alert" className="text-red-500">
      {error}
    </p>
  );
}
```

## Contributing

When adding new features:

1. Write accessibility tests for new components
2. Run `npm run lint` to catch issues early
3. Test with keyboard navigation
4. Verify color contrast meets standards
5. Include accessibility considerations in PR description

## Contact

For accessibility questions or issues:

- Create an issue with the `accessibility` label
- Reference this guide in your PR descriptions
- Consult the team's accessibility champion

---

**Last Updated:** January 2025  
**WCAG Version:** 2.1 Level AA  
**Testing Tools Version:** See `package.json` devDependencies
