import path from "node:path";
import { fileURLToPath } from "node:url";

import globals from "globals";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";
import jestPlugin from "eslint-plugin-jest";
import playwrightPlugin from "eslint-plugin-playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default tseslint.config(
  {
    ignores: [
      ".next/**",
      ".claude/**",
      ".turbo/**",
      ".worktrees/**",
      "android/**",
      "ios/**",
      "app/.well-known/**",
      "__mocks__/**",
      "coverage/**",
      "dist/**",
      "docs/**",
      "node_modules/**",
      "playwright-report/**",
      "public/**",
      "supabase/**",
      "test-results/**",
      "tools/**",
      "e2e/.auth/**",
      "types/database.generated.ts",
    ],
  },
  ...nextCoreWebVitals,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        tsconfigRootDir: __dirname,
        projectService: true,
      },
    },
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
      },
    },
    rules: {
      // This repo uses console output in server routes, scripts, and during
      // debugging. Lint is run with `--max-warnings=0`, so treat console usage
      // as allowed to avoid turning logs into CI failures.
      "no-console": [
        "warn",
        { allow: ["debug", "group", "groupEnd", "info", "log", "table", "warn", "error"] },
      ],
      "react-hooks/error-boundaries": "off",
      "react-hooks/incompatible-library": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "off",
      "@typescript-eslint/require-await": "off",
      "jsx-a11y/anchor-is-valid": [
        "error",
        {
          components: ["Link"],
          specialLink: ["hrefLeft", "hrefRight"],
          aspects: ["invalidHref", "preferButton"],
        },
      ],
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/aria-proptypes": "error",
      "jsx-a11y/aria-unsupported-elements": "error",
      "jsx-a11y/role-has-required-aria-props": "error",
      "jsx-a11y/role-supports-aria-props": "error",
      "no-restricted-globals": [
        "error",
        {
          name: "location",
          message:
            "Use Next.js router (useRouter from 'next/navigation') instead of window.location to maintain SPA behavior",
        },
      ],
      "no-restricted-properties": [
        "error",
        {
          object: "window",
          property: "location",
          message:
            "Use Next.js router (useRouter from 'next/navigation') instead of window.location to maintain SPA behavior",
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "Literal[value=/(?=[\\s\\S]*bg-(?:\\[#F78E42\\]|ocean-blue-decorative|q-orange)(?!\\/))(?=[\\s\\S]*\\btext-white\\b)/]",
          message:
            "WCAG AA contrast failure: full-opacity orange with text-white is 2.36:1. Use bg-ocean-blue with text-white (5.82:1) or keep orange with text-[#11100D] (8.07:1).",
        },
        {
          selector:
            "TemplateElement[value.raw=/(?=[\\s\\S]*bg-(?:\\[#F78E42\\]|ocean-blue-decorative|q-orange)(?!\\/))(?=[\\s\\S]*\\btext-white\\b)/]",
          message:
            "WCAG AA contrast failure: full-opacity orange with text-white is 2.36:1. Use bg-ocean-blue with text-white (5.82:1) or keep orange with text-[#11100D] (8.07:1).",
        },
        // SWC drops the LEADING whitespace of a JSX text node that contains an
        // HTML entity and a newline; Babel keeps it. When that whitespace is
        // significant — a space touching a sibling on the same line — it
        // vanishes from the build only, so the source reads correctly while the
        // page renders "Southern Californiacam". Trailing whitespace is safe.
        // To confirm a suspected site, compile the file with the repo's own SWC
        // (next/dist/build/swc) and read the emitted string literals.
        {
          selector:
            "JSXText[value=/^[ \\t]+[\\s\\S]*\\n/][raw=/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/]",
          message:
            "SWC drops this leading space: the text node holds an HTML entity and a newline. Use the literal character (— – → · “ ” are all allowed) or move the space into {\" \"}.",
        },
      ],
    },
  },
  // Test file overrides (shared by Jest and Playwright)
  {
    files: [
      "**/__tests__/**/*.{ts,tsx,js,jsx}",
      "**/*.test.{ts,tsx,js,jsx}",
      "__mocks__/**/*.{ts,tsx,js,jsx}",
      "jest.setup.{ts,tsx,js,jsx}",
    ],
    rules: {
      "@next/next/no-img-element": "off",
      "react/display-name": "off",
    },
  },
  // Jest-specific rules for unit/integration tests
  {
    files: ["__tests__/**/*.{ts,tsx}", "**/*.test.{ts,tsx}"],
    plugins: { jest: jestPlugin },
    languageOptions: {
      globals: globals.jest,
    },
    rules: {
      "jest/no-disabled-tests": "error",
      "jest/no-conditional-expect": "warn",        // 260 pre-existing — fix in batches
      "jest/expect-expect": "warn",
      "jest/no-standalone-expect": "error",
      "jest/no-restricted-matchers": ["warn", {     // 464 pre-existing — fix in batches
        "toBeDefined": "Use a more specific assertion (toEqual, toMatchObject, etc.)",
        "toBeTruthy": "Use a more specific assertion — objects are always truthy",
      }],
      "jest/valid-expect": "error",
      "jest/no-identical-title": "error",
    },
  },
  {
    files: ["scripts/**/__tests__/**/*.{ts,tsx}"],
    rules: {
      "jest/no-standalone-expect": "off",
    },
  },
  // Playwright-specific rules for E2E tests
  {
    files: ["e2e/**/*.{ts,tsx}", "e2e/**/*.spec.{ts,tsx}"],
    plugins: { playwright: playwrightPlugin },
    rules: {
      "playwright/no-wait-for-timeout": "warn",    // 40 pre-existing — fix in batches
      "playwright/no-conditional-in-test": "warn",
      "playwright/expect-expect": "warn",
      "playwright/no-skipped-test": "warn",         // 12 pre-existing — fix in batches
      "playwright/no-raw-locators": "off",
    },
  },
);
