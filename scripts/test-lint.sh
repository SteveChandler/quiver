#!/bin/bash
# Gate: patterns that ESLint rules don't cover
# Run in CI to catch anti-patterns that slip past lint
ERRORS=0

# Global console suppression (should use allowlist pattern, not blanket override)
if grep -n "global.console = {" jest.setup.js 2>/dev/null; then
  echo "ERROR: Global console suppression found in jest.setup.js"
  ERRORS=$((ERRORS + 1))
fi

# .catch(() => false) in E2E tests (silent assertion skip)
COUNT=$(grep -rn '\.catch(() => false)' e2e/ --include="*.spec.ts" 2>/dev/null | wc -l | tr -d ' ')
if [ "$COUNT" -gt "0" ]; then
  echo "ERROR: $COUNT instances of .catch(() => false) in E2E specs"
  grep -rn '\.catch(() => false)' e2e/ --include="*.spec.ts" 2>/dev/null | head -5
  ERRORS=$((ERRORS + 1))
fi

# console.error = jest.fn() without assertion (unguarded mocking)
COUNT=$(grep -rn 'console\.error = jest\.fn()' __tests__/ --include="*.test.*" 2>/dev/null | wc -l | tr -d ' ')
if [ "$COUNT" -gt "0" ]; then
  echo "ERROR: $COUNT instances of unguarded console.error mocking in unit tests"
  grep -rn 'console\.error = jest\.fn()' __tests__/ --include="*.test.*" 2>/dev/null | head -5
  ERRORS=$((ERRORS + 1))
fi

if [ "$ERRORS" -eq "0" ]; then
  echo "OK: All test-lint checks passed"
fi

exit $ERRORS
