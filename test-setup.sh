#!/bin/bash

# Test script for GitHub Copilot Server
# This script validates the server code structure and dependencies

echo "🧪 Testing GitHub Copilot CLI Server Setup"
echo "==========================================="
echo ""

# Check Node.js version
echo "📦 Checking Node.js version..."
NODE_VERSION=$(node --version)
echo "   Node.js: $NODE_VERSION"

# Check npm version
echo "📦 Checking npm version..."
NPM_VERSION=$(npm --version)
echo "   npm: $NPM_VERSION"

# Check if server directory exists
echo ""
echo "📁 Checking server directory..."
if [ -d "src/server" ]; then
    echo "   ✅ src/server directory exists"
else
    echo "   ❌ src/server directory not found"
    exit 1
fi

# Check if package.json exists
echo ""
echo "📄 Checking package.json..."
if [ -f "src/server/package.json" ]; then
    echo "   ✅ package.json exists"
    cat src/server/package.json | grep -E '"name"|"version"|"dependencies"' | head -10
else
    echo "   ❌ package.json not found"
    exit 1
fi

# Check if index.js exists
echo ""
echo "📄 Checking index.js..."
if [ -f "src/server/index.js" ]; then
    echo "   ✅ index.js exists"
    echo "   Lines of code: $(wc -l < src/server/index.js)"
else
    echo "   ❌ index.js not found"
    exit 1
fi

# Check Dockerfile
echo ""
echo "🐳 Checking Dockerfile..."
if [ -f "Dockerfile" ]; then
    echo "   ✅ Dockerfile exists"
    echo "   Base image: $(grep -m 1 "^FROM" Dockerfile)"
else
    echo "   ❌ Dockerfile not found"
    exit 1
fi

# Check docker-compose.yml
echo ""
echo "🐳 Checking docker-compose.yml..."
if [ -f "docker-compose.yml" ]; then
    echo "   ✅ docker-compose.yml exists"
else
    echo "   ❌ docker-compose.yml not found"
    exit 1
fi

# Check .dockerignore
echo ""
echo "🐳 Checking .dockerignore..."
if [ -f ".dockerignore" ]; then
    echo "   ✅ .dockerignore exists"
    echo "   Ignored patterns: $(wc -l < .dockerignore) lines"
else
    echo "   ⚠️  .dockerignore not found (recommended)"
fi

# Check GitHub workflow
echo ""
echo "🔄 Checking GitHub Actions workflow..."
if [ -f ".github/workflows/docker-publish.yml" ]; then
    echo "   ✅ docker-publish.yml exists"
else
    echo "   ❌ docker-publish.yml not found"
    exit 1
fi

# Check documentation
echo ""
echo "📚 Checking documentation..."
if [ -f "DOCKER.md" ]; then
    echo "   ✅ DOCKER.md exists"
    echo "   Size: $(wc -l < DOCKER.md) lines"
else
    echo "   ❌ DOCKER.md not found"
    exit 1
fi

# Check .env.example
echo ""
echo "🔐 Checking .env.example..."
if [ -f ".env.example" ]; then
    echo "   ✅ .env.example exists"
else
    echo "   ⚠️  .env.example not found (recommended)"
fi

# Validate JavaScript syntax
echo ""
echo "✅ Validating JavaScript syntax..."
if node --check src/server/index.js 2>/dev/null; then
    echo "   ✅ index.js syntax is valid"
else
    echo "   ❌ index.js has syntax errors"
    node --check src/server/index.js
    exit 1
fi

echo ""
echo "==========================================="
echo "✅ All checks passed!"
echo ""
echo "📋 Summary:"
echo "   - Server code structure: ✅"
echo "   - Docker configuration: ✅"
echo "   - GitHub Actions workflow: ✅"
echo "   - Documentation: ✅"
echo ""
echo "🚀 Next steps:"
echo "   1. Set your GitHub token in .env file"
echo "   2. Run: docker-compose up -d"
echo "   3. Test: curl http://localhost:3000/health"
echo ""
