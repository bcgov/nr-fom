#!/usr/bin/env bash
set -euo pipefail

BRANCH_NAME="${1:-$(git branch --show-current)}"
echo "🔍 Starting PR Verification for branch: $BRANCH_NAME"

# 1. Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "⚠️ Warning: You have uncommitted changes. Please stash or commit them first."
    exit 1
fi

# 2. Build and Test API
if [ -d "api" ]; then
    echo "📦 Verifying API..."
    (cd api && npm ci --ignore-scripts && npm run build:api && npm run test-unit)
fi

# 3. Build and Test Admin
if [ -d "admin" ]; then
    echo "📦 Verifying Admin..."
    (cd admin && npm ci --ignore-scripts && npm run test-unit)
fi

# 4. Build and Test Public
if [ -d "public" ]; then
    echo "📦 Verifying Public..."
    (cd public && npm ci --ignore-scripts && npm run test-unit)
fi

echo "✅ PR Verification Complete! All builds and tests passed."
