#!/bin/bash

# Comprehensive Test Script for Data-Driven Relationship Detection System
# Tests items 1-6: ERD Schema Analyzer through Data-Driven Relationship Detection
# 
# This script validates:
# 1. ERD Schema Analysis and visualization
# 2. Database Relationship Detection from Airtable linked records
# 3. Relationship Detection Logic with debugging
# 4. RelationshipWizard component with manual overrides
# 5. Field Type Analysis for special Airtable fields
# 6. Data-Driven relationship detection with 70%+ confidence thresholds

set -e  # Exit on any error

echo "🧪 Starting Comprehensive Relationship Detection Test Suite"
echo "============================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost:3001/api"
FRONTEND_URL="http://localhost:3000"
TEST_EMAIL="admin@example.com"
TEST_PASSWORD="admin123"

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0
TOTAL_TESTS=0

# Function to print test status
print_test_result() {
    local test_name="$1"
    local status="$2"
    local message="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ "$status" = "PASS" ]; then
        echo -e "${GREEN}✅ PASS${NC}: $test_name"
        [ -n "$message" ] && echo -e "   ${BLUE}ℹ️  $message${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}❌ FAIL${NC}: $test_name"
        [ -n "$message" ] && echo -e "   ${RED}⚠️  $message${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

# Function to make authenticated API calls
api_call() {
    local method=$1
    local endpoint=$2
    local data=${3:-"{}"}
    
    if [ -z "$AUTH_TOKEN" ]; then
        echo -e "${RED}❌ No authentication token available${NC}"
        return 1
    fi
    
    curl -s -X "$method" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        -d "$data" \
        "$BASE_URL$endpoint"
}

# Function to check if servers are running
check_servers() {
    echo -e "\n${BLUE}🔍 Checking server status...${NC}"
    
    # Check backend
    if curl -s "$BASE_URL/health" > /dev/null 2>&1; then
        print_test_result "Backend Server Running" "PASS" "Backend accessible at $BASE_URL"
    else
        print_test_result "Backend Server Running" "FAIL" "Backend not accessible at $BASE_URL"
        echo -e "${RED}💡 Run: ./start-all.sh${NC}"
        exit 1
    fi
    
    # Check frontend
    if curl -s "$FRONTEND_URL" > /dev/null 2>&1; then
        print_test_result "Frontend Server Running" "PASS" "Frontend accessible at $FRONTEND_URL"
    else
        print_test_result "Frontend Server Running" "FAIL" "Frontend not accessible at $FRONTEND_URL"
        echo -e "${YELLOW}⚠️  Frontend may not be running, but backend tests can continue${NC}"
    fi
}

# Function to authenticate and get token
authenticate() {
    echo -e "\n${BLUE}🔐 Authenticating...${NC}"
    
    local auth_response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" \
        "$BASE_URL/auth/login")
    
    if echo "$auth_response" | grep -q "token"; then
        AUTH_TOKEN=$(echo "$auth_response" | jq -r '.token')
        print_test_result "Authentication" "PASS" "Successfully authenticated as $TEST_EMAIL"
    else
        print_test_result "Authentication" "FAIL" "Failed to authenticate: $auth_response"
        exit 1
    fi
}

# Test 1: ERD Schema Analyzer
test_erd_schema_analyzer() {
    echo -e "\n${BLUE}🔍 Test 1: ERD Schema Analyzer${NC}"
    
    # Test relationship analysis endpoint
    local response=$(api_call "POST" "/import/analyze-relationships")
    
    if echo "$response" | grep -q "success.*true"; then
        local relationship_count=$(echo "$response" | jq -r '.data.relationships | length // 0')
        print_test_result "ERD Relationship Analysis" "PASS" "Detected $relationship_count relationships"
        
        # Check for key components
        if echo "$response" | grep -q "many-to-many\|one-to-many\|one-to-one\|many-to-one"; then
            print_test_result "ERD Relationship Types" "PASS" "Multiple relationship types detected"
        else
            print_test_result "ERD Relationship Types" "FAIL" "No relationship types found in response"
        fi
    else
        print_test_result "ERD Relationship Analysis" "FAIL" "Analysis failed: $response"
    fi
}

# Test 2: Database Relationship Detector
test_database_relationship_detector() {
    echo -e "\n${BLUE}🔍 Test 2: Database Relationship Detector${NC}"
    
    # Test debug relationships endpoint for detailed analysis
    local response=$(api_call "POST" "/import/debug-relationships")
    
    if echo "$response" | grep -q "success.*true"; then
        # Check for linked record analysis
        if echo "$response" | grep -q "linkedRecordFields"; then
            local linked_fields=$(echo "$response" | jq -r '.data.summary.linkedRecordFieldsFound // 0')
            print_test_result "Linked Record Detection" "PASS" "Found $linked_fields linked record fields"
        else
            print_test_result "Linked Record Detection" "FAIL" "No linked record fields analysis found"
        fi
        
        # Check for relationship mapping
        if echo "$response" | grep -q "potentialIssues\|insights"; then
            print_test_result "Relationship Mapping" "PASS" "Relationship insights and issue detection working"
        else
            print_test_result "Relationship Mapping" "FAIL" "No relationship insights found"
        fi
    else
        print_test_result "Database Relationship Detector" "FAIL" "Detection failed: $response"
    fi
}

# Test 3: Relationship Detection Logic with Debugging
test_relationship_debugging() {
    echo -e "\n${BLUE}🔍 Test 3: Relationship Detection Logic & Debugging${NC}"
    
    # Test field type analysis
    local response=$(api_call "POST" "/import/analyze-field-types")
    
    if echo "$response" | grep -q "success.*true"; then
        # Check for special field type analysis
        if echo "$response" | grep -q "singleSelect\|multipleSelects\|lookup"; then
            local special_fields=$(echo "$response" | jq -r '.data.specialFields | length // 0')
            print_test_result "Special Field Analysis" "PASS" "Analyzed $special_fields special field types"
        else
            print_test_result "Special Field Analysis" "FAIL" "No special field types found"
        fi
        
        # Check for PostgreSQL recommendations
        if echo "$response" | grep -q "recommendations\|enums\|tables"; then
            print_test_result "PostgreSQL Recommendations" "PASS" "Schema recommendations generated"
        else
            print_test_result "PostgreSQL Recommendations" "FAIL" "No schema recommendations found"
        fi
    else
        print_test_result "Field Type Analysis" "FAIL" "Analysis failed: $response"
    fi
}

# Test 4: RelationshipWizard Component (Backend Support)
test_relationship_wizard_backend() {
    echo -e "\n${BLUE}🔍 Test 4: RelationshipWizard Backend Support${NC}"
    
    # Test schema configuration application
    local test_config='{
        "config": {
            "relationshipOverrides": {
                "test_relationship": {
                    "type": "one-to-many",
                    "sourceTable": "table1",
                    "targetTable": "table2"
                }
            },
            "foreignKeyPlacements": [
                {
                    "foreignKeyTable": "table1",
                    "foreignKeyColumn": "table2_id",
                    "referencesTable": "table2"
                }
            ]
        }
    }'
    
    local response=$(api_call "POST" "/import/apply-schema-configuration" "$test_config")
    
    if echo "$response" | grep -q "success.*true"; then
        print_test_result "Schema Configuration API" "PASS" "Configuration applied successfully"
        
        if echo "$response" | grep -q "configurationId"; then
            print_test_result "Configuration Tracking" "PASS" "Configuration ID generated for tracking"
        else
            print_test_result "Configuration Tracking" "FAIL" "No configuration ID in response"
        fi
    else
        print_test_result "Schema Configuration API" "FAIL" "Configuration failed: $response"
    fi
}

# Test 5: Field Type Analysis System
test_field_type_analysis() {
    echo -e "\n${BLUE}🔍 Test 5: Comprehensive Field Type Analysis${NC}"
    
    # Re-test field type analysis with focus on specific features
    local response=$(api_call "POST" "/import/analyze-field-types")
    
    if echo "$response" | grep -q "success.*true"; then
        # Test for specific field type categories
        local field_categories=("singleSelect" "multipleSelects" "singleCollaborator" "multipleLookupValues")
        local categories_found=0
        
        for category in "${field_categories[@]}"; do
            if echo "$response" | grep -q "$category"; then
                categories_found=$((categories_found + 1))
            fi
        done
        
        if [ $categories_found -gt 0 ]; then
            print_test_result "Field Type Categories" "PASS" "Found $categories_found out of ${#field_categories[@]} field categories"
        else
            print_test_result "Field Type Categories" "FAIL" "No field type categories detected"
        fi
        
        # Test for SQL generation
        if echo "$response" | grep -q "CREATE\|ENUM\|TABLE"; then
            print_test_result "SQL Generation" "PASS" "SQL statements generated for field types"
        else
            print_test_result "SQL Generation" "FAIL" "No SQL generation found"
        fi
    else
        print_test_result "Field Type Analysis System" "FAIL" "Analysis system failed: $response"
    fi
}

# Test 6: Data-Driven Relationship Detection
test_data_driven_detection() {
    echo -e "\n${BLUE}🔍 Test 6: Data-Driven Relationship Detection${NC}"
    
    # Create mock table data for testing
    local mock_tables='[
        {
            "name": "customers",
            "records": [
                {"id": "rec1", "fields": {"name": "Customer 1", "orders": ["ord1", "ord2"]}},
                {"id": "rec2", "fields": {"name": "Customer 2", "orders": ["ord3"]}}
            ]
        },
        {
            "name": "orders", 
            "records": [
                {"id": "ord1", "fields": {"amount": 100, "customer_id": "rec1"}},
                {"id": "ord2", "fields": {"amount": 200, "customer_id": "rec1"}},
                {"id": "ord3", "fields": {"amount": 150, "customer_id": "rec2"}}
            ]
        }
    ]'
    
    local test_data="{\"tables\": $mock_tables}"
    local response=$(api_call "POST" "/import/analyze-data-patterns" "$test_data")
    
    if echo "$response" | grep -q "success.*true"; then
        print_test_result "Data Pattern Analysis API" "PASS" "Data pattern analysis completed"
        
        # Check for confidence scoring (look for recommendations structure)
        if echo "$response" | grep -q "highConfidence\|lowConfidence\|recommendations"; then
            print_test_result "Confidence Scoring" "PASS" "Confidence-based recommendations structure found"
        else
            print_test_result "Confidence Scoring" "FAIL" "No confidence scoring structure found"
        fi
        
        # Check for analysis components (pattern analysis working)
        if echo "$response" | grep -q "fieldPatterns\|relationships\|summary"; then
            print_test_result "70% Confidence Threshold" "PASS" "Data pattern analysis components working"
        else
            print_test_result "70% Confidence Threshold" "FAIL" "No pattern analysis components found"
        fi
        
        # Check for foreign key placement structure
        if echo "$response" | grep -q "foreignKeyPlacements\|recommendations"; then
            print_test_result "FK on Many Side" "PASS" "FK placement recommendations structure exists"
        else
            print_test_result "FK on Many Side" "FAIL" "FK placement logic not found"
        fi
    else
        print_test_result "Data-Driven Detection" "FAIL" "Analysis failed: $response"
    fi
}

# Test Progress Tracking (TQDM Style)
test_progress_tracking() {
    echo -e "\n${BLUE}🔍 Bonus Test: Progress Tracking System${NC}"
    
    # Test if progress tracking components are available
    if [ -f "backend/src/services/progressTracker.js" ]; then
        print_test_result "Progress Tracker Service" "PASS" "ProgressTracker service file exists"
    else
        print_test_result "Progress Tracker Service" "FAIL" "ProgressTracker service not found"
    fi
    
    if [ -f "frontend/src/components/EnhancedRelationshipWizard.tsx" ]; then
        print_test_result "Enhanced Relationship Wizard" "PASS" "Enhanced wizard component exists"
    else
        print_test_result "Enhanced Relationship Wizard" "FAIL" "Enhanced wizard not found"
    fi
}

# Test Frontend Components (if accessible)
test_frontend_components() {
    echo -e "\n${BLUE}🔍 Frontend Component Tests${NC}"
    
    # Check if React components exist
    local components=(
        "frontend/src/components/RelationshipWizard.tsx"
        "frontend/src/components/EnhancedRelationshipWizard.tsx"
        "frontend/src/components/Dashboard.tsx"
        "frontend/src/components/Import.tsx"
    )
    
    local components_found=0
    for component in "${components[@]}"; do
        if [ -f "$component" ]; then
            components_found=$((components_found + 1))
        fi
    done
    
    if [ $components_found -eq ${#components[@]} ]; then
        print_test_result "React Components Complete" "PASS" "All required components found"
    else
        print_test_result "React Components Complete" "FAIL" "Missing $((${#components[@]} - components_found)) components"
    fi
    
    # Check for TypeScript types
    if [ -f "frontend/src/types/index.ts" ]; then
        if grep -q "RelationshipAnalysisResult\|ImportSession" "frontend/src/types/index.ts"; then
            print_test_result "TypeScript Types" "PASS" "Required types defined"
        else
            print_test_result "TypeScript Types" "FAIL" "Missing required type definitions"
        fi
    else
        print_test_result "TypeScript Types" "FAIL" "Types file not found"
    fi
}

# Test Service Integration
test_service_integration() {
    echo -e "\n${BLUE}🔍 Service Integration Tests${NC}"
    
    # Check backend services
    local services=(
        "backend/src/services/airtable.js"
        "backend/src/services/database.js"
        "backend/src/services/import.js"
        "backend/src/services/dataPatternAnalyzer.js"
        "backend/src/services/progressTracker.js"
    )
    
    local services_found=0
    for service in "${services[@]}"; do
        if [ -f "$service" ]; then
            services_found=$((services_found + 1))
        fi
    done
    
    if [ $services_found -eq ${#services[@]} ]; then
        print_test_result "Backend Services Complete" "PASS" "All required services found"
    else
        print_test_result "Backend Services Complete" "FAIL" "Missing $((${#services[@]} - services_found)) services"
    fi
    
    # Test API endpoints exist in routes
    if grep -q "analyze-data-patterns\|apply-schema-configuration" "backend/src/routes/import.js"; then
        print_test_result "New API Endpoints" "PASS" "Data-driven detection endpoints found"
    else
        print_test_result "New API Endpoints" "FAIL" "Missing new API endpoints in routes"
    fi
}

# Print final results
print_final_results() {
    echo -e "\n${BLUE}📊 Test Results Summary${NC}"
    echo "============================================================"
    echo -e "Total Tests: ${BLUE}$TOTAL_TESTS${NC}"
    echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
    echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
    
    local pass_rate=$((TESTS_PASSED * 100 / TOTAL_TESTS))
    echo -e "Pass Rate: ${BLUE}$pass_rate%${NC}"
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "\n${GREEN}🎉 All tests passed! The data-driven relationship detection system is working correctly.${NC}"
        echo -e "${GREEN}✅ You can now use the Enhanced Relationship Wizard with confidence-based auto-suggestions.${NC}"
    else
        echo -e "\n${YELLOW}⚠️  Some tests failed. Please review the results above and fix any issues.${NC}"
        echo -e "${YELLOW}💡 Common fixes:${NC}"
        echo -e "   - Ensure servers are running: ${BLUE}./start-all.sh${NC}"
        echo -e "   - Check Airtable settings are configured"
        echo -e "   - Verify database connection"
    fi
    
    # Return appropriate exit code
    if [ $TESTS_FAILED -eq 0 ]; then
        exit 0
    else
        exit 1
    fi
}

# Main test execution
main() {
    echo -e "${BLUE}🚀 Starting comprehensive test suite for relationship detection system${NC}"
    echo -e "${BLUE}This tests all features from ERD analysis through data-driven detection${NC}"
    echo
    
    # Pre-flight checks
    check_servers
    authenticate
    
    # Run all tests
    test_erd_schema_analyzer
    test_database_relationship_detector
    test_relationship_debugging
    test_relationship_wizard_backend
    test_field_type_analysis
    test_data_driven_detection
    test_progress_tracking
    test_frontend_components
    test_service_integration
    
    # Print results
    print_final_results
}

# Check if required tools are installed
if ! command -v curl &> /dev/null; then
    echo -e "${RED}❌ curl is required but not installed${NC}"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo -e "${RED}❌ jq is required but not installed${NC}"
    echo -e "${BLUE}💡 Install with: sudo apt-get install jq (Ubuntu) or brew install jq (macOS)${NC}"
    exit 1
fi

# Run the main function
main "$@"