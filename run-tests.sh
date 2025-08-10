#!/bin/bash

# WTFIsOnMyPort Complete Test Runner
# Usage: ./run-tests.sh [test-type]
# Options: unit, e2e, memory, all

set -e

echo "🧪 WTFIsOnMyPort Test Suite"
echo "=========================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse arguments
TEST_TYPE=${1:-all}

# Function to run tests with status
run_test() {
    local test_name=$1
    local test_command=$2
    
    echo -e "\n${YELLOW}Running ${test_name}...${NC}"
    
    if eval "$test_command"; then
        echo -e "${GREEN}✅ ${test_name} passed${NC}"
        return 0
    else
        echo -e "${RED}❌ ${test_name} failed${NC}"
        return 1
    fi
}

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm ci
fi

# Track test results
FAILED_TESTS=()

case $TEST_TYPE in
    unit)
        run_test "Unit Tests" "npm test" || FAILED_TESTS+=("Unit Tests")
        ;;
    
    e2e)
        run_test "E2E Tests" "npm run test:e2e" || FAILED_TESTS+=("E2E Tests")
        ;;
    
    memory)
        echo -e "${YELLOW}⚠️  Memory tests take approximately 1 hour${NC}"
        read -p "Continue? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            run_test "Memory Leak Tests" "npm run test:memory" || FAILED_TESTS+=("Memory Tests")
        fi
        ;;
    
    coverage)
        run_test "Coverage Tests" "npm run test:coverage" || FAILED_TESTS+=("Coverage Tests")
        echo "Coverage report available at: coverage/index.html"
        ;;
    
    all)
        # Run all tests except memory (too long for regular runs)
        run_test "Unit Tests" "npm test" || FAILED_TESTS+=("Unit Tests")
        run_test "Coverage Analysis" "npm run test:coverage" || FAILED_TESTS+=("Coverage")
        
        # Build app for E2E tests
        echo -e "\n${YELLOW}Building app for E2E tests...${NC}"
        npm run package
        
        run_test "E2E Tests" "npm run test:e2e" || FAILED_TESTS+=("E2E Tests")
        
        echo -e "\n${YELLOW}Note: Memory tests skipped (run with './run-tests.sh memory')${NC}"
        ;;
    
    *)
        echo "Usage: $0 [unit|e2e|memory|coverage|all]"
        exit 1
        ;;
esac

# Summary
echo -e "\n${YELLOW}========== TEST SUMMARY ==========${NC}"

if [ ${#FAILED_TESTS[@]} -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    
    # Show coverage summary if available
    if [ -f "coverage/coverage-summary.json" ]; then
        echo -e "\n${YELLOW}Coverage Summary:${NC}"
        node -e "
        const coverage = require('./coverage/coverage-summary.json');
        const total = coverage.total;
        console.log('  Lines:', total.lines.pct + '%');
        console.log('  Statements:', total.statements.pct + '%');
        console.log('  Functions:', total.functions.pct + '%');
        console.log('  Branches:', total.branches.pct + '%');
        "
    fi
    
    exit 0
else
    echo -e "${RED}❌ Failed tests:${NC}"
    for test in "${FAILED_TESTS[@]}"; do
        echo -e "  - ${test}"
    done
    exit 1
fi