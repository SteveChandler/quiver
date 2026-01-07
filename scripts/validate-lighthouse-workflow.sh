#!/bin/bash

# Lighthouse CI Workflow Validation Script
# This script helps validate the Lighthouse CI workflow setup before pushing to GitHub

set -e

echo "🔍 Lighthouse CI Workflow Validation"
echo "===================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Validation functions
validate_yaml() {
    echo "1️⃣  Validating YAML syntax..."
    if npx -y js-yaml .github/workflows/lighthouse-ci.yml > /dev/null 2>&1; then
        echo -e "${GREEN}✅ YAML syntax is valid${NC}"
        return 0
    else
        echo -e "${RED}❌ YAML syntax error${NC}"
        return 1
    fi
}

validate_config() {
    echo ""
    echo "2️⃣  Checking Lighthouse CI configuration..."
    if [ -f ".lighthouserc.json" ]; then
        echo -e "${GREEN}✅ .lighthouserc.json exists${NC}"

        # Validate JSON syntax
        if npx -y json5 .lighthouserc.json > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Configuration JSON is valid${NC}"
        else
            echo -e "${RED}❌ Configuration JSON is invalid${NC}"
            return 1
        fi

        # Check for required fields
        if grep -q '"url"' .lighthouserc.json; then
            echo -e "${GREEN}✅ URL configuration found${NC}"
        else
            echo -e "${YELLOW}⚠️  URL configuration not found${NC}"
        fi

        return 0
    else
        echo -e "${RED}❌ .lighthouserc.json not found${NC}"
        return 1
    fi
}

validate_package_json() {
    echo ""
    echo "3️⃣  Checking package.json scripts..."

    if grep -q '"lighthouse:ci"' package.json; then
        echo -e "${GREEN}✅ lighthouse:ci script exists${NC}"
    else
        echo -e "${YELLOW}⚠️  lighthouse:ci script not found${NC}"
    fi

    if grep -q '"build"' package.json; then
        echo -e "${GREEN}✅ build script exists${NC}"
    else
        echo -e "${RED}❌ build script not found${NC}"
        return 1
    fi

    if grep -q '"start"' package.json; then
        echo -e "${GREEN}✅ start script exists${NC}"
    else
        echo -e "${RED}❌ start script not found${NC}"
        return 1
    fi

    return 0
}

check_dependencies() {
    echo ""
    echo "4️⃣  Checking dependencies..."

    if grep -q '"@lhci/cli"' package.json; then
        echo -e "${GREEN}✅ @lhci/cli is in package.json${NC}"
    else
        echo -e "${YELLOW}⚠️  @lhci/cli is not in package.json (will be installed by workflow)${NC}"
    fi

    return 0
}

validate_env_example() {
    echo ""
    echo "5️⃣  Checking environment configuration..."

    if [ -f ".env.example" ]; then
        echo -e "${GREEN}✅ .env.example exists${NC}"

        # Check for required variables
        required_vars=(
            "NEXT_PUBLIC_SUPABASE_URL"
            "NEXT_PUBLIC_SUPABASE_ANON_KEY"
            "NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN"
            "FIREBASE_PROJECT_ID"
        )

        for var in "${required_vars[@]}"; do
            if grep -q "$var" .env.example; then
                echo -e "${GREEN}  ✅ $var documented${NC}"
            else
                echo -e "${YELLOW}  ⚠️  $var not in .env.example${NC}"
            fi
        done

        return 0
    else
        echo -e "${YELLOW}⚠️  .env.example not found${NC}"
        return 0
    fi
}

check_documentation() {
    echo ""
    echo "6️⃣  Checking documentation..."

    docs=(
        ".github/workflows/LIGHTHOUSE_CI.md"
        ".github/workflows/LIGHTHOUSE_CI_SETUP.md"
        "LIGHTHOUSE_CI_SUMMARY.md"
    )

    for doc in "${docs[@]}"; do
        if [ -f "$doc" ]; then
            echo -e "${GREEN}  ✅ $doc exists${NC}"
        else
            echo -e "${RED}  ❌ $doc missing${NC}"
        fi
    done

    return 0
}

test_local_build() {
    echo ""
    echo "7️⃣  Testing local build (optional)..."
    echo -e "${YELLOW}This will run 'yarn build' to verify the workflow will succeed${NC}"
    read -p "Run local build test? (y/N): " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Building application..."
        if yarn build > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Build successful${NC}"
            return 0
        else
            echo -e "${RED}❌ Build failed - fix before pushing${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}⏭️  Skipping build test${NC}"
        return 0
    fi
}

print_github_secrets() {
    echo ""
    echo "8️⃣  GitHub Secrets Checklist"
    echo "=============================="
    echo ""
    echo "Configure the following secrets in GitHub:"
    echo "Settings → Secrets and variables → Actions → New repository secret"
    echo ""
    echo "Required Supabase secrets:"
    echo "  - NEXT_PUBLIC_SUPABASE_URL"
    echo "  - NEXT_PUBLIC_SUPABASE_ANON_KEY"
    echo "  - SUPABASE_SERVICE_ROLE_KEY"
    echo ""
    echo "Required Mapbox secret:"
    echo "  - NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN"
    echo ""
    echo "Required Firebase secrets:"
    echo "  - FIREBASE_PROJECT_ID"
    echo "  - FIREBASE_CLIENT_EMAIL"
    echo "  - FIREBASE_PRIVATE_KEY"
    echo "  - NEXT_PUBLIC_FIREBASE_API_KEY"
    echo "  - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"
    echo "  - NEXT_PUBLIC_FIREBASE_PROJECT_ID"
    echo "  - NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"
    echo "  - NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"
    echo "  - NEXT_PUBLIC_FIREBASE_APP_ID"
    echo "  - NEXT_PUBLIC_FIREBASE_VAPID_KEY"
    echo ""
    echo "Optional secret:"
    echo "  - LHCI_GITHUB_APP_TOKEN (for PR comments)"
    echo ""
    echo "📚 See .github/workflows/LIGHTHOUSE_CI_SETUP.md for detailed setup instructions"
    echo ""
}

# Main execution
main() {
    validate_yaml || exit 1
    validate_config || exit 1
    validate_package_json || exit 1
    check_dependencies
    validate_env_example
    check_documentation
    test_local_build
    print_github_secrets

    echo ""
    echo "=============================="
    echo -e "${GREEN}✅ Validation Complete!${NC}"
    echo "=============================="
    echo ""
    echo "Next steps:"
    echo "1. Configure GitHub secrets (see checklist above)"
    echo "2. Commit the workflow files"
    echo "3. Push to main or develop branch"
    echo "4. Monitor the workflow in GitHub Actions"
    echo ""
    echo "For detailed instructions, see:"
    echo "  - .github/workflows/LIGHTHOUSE_CI_SETUP.md"
    echo "  - LIGHTHOUSE_CI_SUMMARY.md"
    echo ""
}

# Run main function
main
