import path from "node:path";
import { fileURLToPath } from "node:url";

import globals from "globals";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default tseslint.config(
  {
    ignores: [
      ".next/**",
      ".turbo/**",
      "android/**",
      "ios/**",
      "app/.well-known/**",
      "__tests__/**",
      "__mocks__/**",
      "coverage/**",
      "dist/**",
      "docs/**",
      "e2e/**",
      "node_modules/**",
      "playwright-report/**",
      "public/**",
      "scripts/**",
      "supabase/**",
      "test-results/**",
      "e2e/.auth/**",
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
        { allow: ["debug", "info", "log", "warn", "error"] },
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
    },
  },
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
  }
);
