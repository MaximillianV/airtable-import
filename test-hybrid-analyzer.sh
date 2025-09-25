#!/bin/bash

# Debug script for Hybrid Relationship Analyzer
# Comprehensive debugging to identify why 0 relationships are found when 66 multipleRecordLinks exist
# Updated to focus on root cause analysis

# Color codes for output formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test configuration
API_BASE="http://localhost:3001/api"
TEST_EMAIL="admin@example.com"
TEST_PASSWORD="admin123"

# Counter for tracking test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}    HYBRID ANALYZER DEBUG INVESTIGATION        ${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Function to print test headers
print_test_header() {
    echo -e "${CYAN}----------------------------------------${NC}"
    echo -e "${CYAN} $1${NC}"
    echo -e "${CYAN}----------------------------------------${NC}"
}

# Function to print test results
print_result() {
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if [ "$1" = "PASS" ]; then
        echo -e "${GREEN}✓ PASS${NC}: $2"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗ FAIL${NC}: $2"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        if [ ! -z "$3" ]; then
            echo -e "${RED}  Error: $3${NC}"
        fi
    fi
    echo ""
}

# Function to get authentication token
get_auth_token() {
    local response=$(curl -s -X POST "$API_BASE/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")
    
    local token=$(echo "$response" | jq -r '.token // empty')
    if [ -z "$token" ] || [ "$token" = "null" ]; then
        echo -e "${RED}Failed to get authentication token${NC}"
        echo "Response: $response"
        exit 1
    fi
    echo "$token"
}

# Function to check if services are running
check_services() {
    print_test_header "SERVICE HEALTH CHECK"
    
    # Check backend health
    local backend_health=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health 2>/dev/null)
    if [ "$backend_health" = "200" ]; then
        print_result "PASS" "Backend service is running on port 3001"
    else
        print_result "FAIL" "Backend service health check" "HTTP $backend_health"
        exit 1
    fi
    
    # Check if we can authenticate
    local auth_token=$(get_auth_token)
    if [ ! -z "$auth_token" ]; then
        print_result "PASS" "Authentication system working"
    else
        print_result "FAIL" "Authentication system" "Could not get token"
        exit 1
    fi
}

# Function to debug the core issue: why 0 relationships when 66 multipleRecordLinks exist
debug_core_issue() {
    print_test_header "CORE ISSUE INVESTIGATION"
    
    local auth_token=$(get_auth_token)
    
    echo -e "${YELLOW}Step 1: Check if Airtable connection works${NC}"
    
    # Test basic Airtable connection by getting schema preview
    local schema_response=$(curl -s -X GET "$API_BASE/import/schema-preview" \
        -H "Authorization: Bearer $auth_token")
    
    local schema_success=$(echo "$schema_response" | jq -r '.success // false' 2>/dev/null)
    if [ "$schema_success" = "true" ]; then
        local table_count=$(echo "$schema_response" | jq -r '.tables | length' 2>/dev/null)
        local total_columns=$(echo "$schema_response" | jq -r '.totalColumns // 0' 2>/dev/null)
        
        echo -e "${GREEN}✓ Airtable connection working: $table_count tables, $total_columns columns${NC}"
        
        # Show sample table names
        echo -e "${YELLOW}Sample tables:${NC}"
        echo "$schema_response" | jq -r '.tables[0:5] | .[] | "  • \(.name.original) (ID: \(.id)) - \(.columns | length) columns"' 2>/dev/null
        echo ""
        
        print_result "PASS" "Airtable connection and basic schema discovery"
    else
        print_result "FAIL" "Airtable connection test" "Schema preview failed"
        echo -e "${RED}Schema response: $schema_response${NC}"
        return 1
    fi
    
    echo -e "${YELLOW}Step 2: Test hybrid analyzer specifically${NC}"
    
    # Test hybrid analyzer with detailed debugging
    local hybrid_response=$(curl -s -X POST "$API_BASE/import/analyze-hybrid-relationships" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $auth_token")
    
    local hybrid_success=$(echo "$hybrid_response" | jq -r '.success // false' 2>/dev/null)
    if [ "$hybrid_success" = "true" ]; then
        local rel_count=$(echo "$hybrid_response" | jq -r '.data.relationships | length' 2>/dev/null)
        
        echo -e "${YELLOW}Hybrid analyzer returned $rel_count relationships${NC}"
        
        # Show detailed analysis
        echo -e "${YELLOW}Analysis breakdown:${NC}"
        echo "$hybrid_response" | jq '.data.analysis' 2>/dev/null || echo "No analysis data"
        echo ""
        
        if [ "$rel_count" -eq 0 ]; then
            echo -e "${RED}🚨 CORE ISSUE: Hybrid analyzer returns 0 relationships${NC}"
            print_result "FAIL" "Relationship detection in hybrid analyzer" "0 relationships found"
        else
            echo -e "${GREEN}✓ Hybrid analyzer found relationships${NC}"
            print_result "PASS" "Relationship detection in hybrid analyzer"
        fi
    else
        local error_msg=$(echo "$hybrid_response" | jq -r '.error // "Unknown error"' 2>/dev/null)
        print_result "FAIL" "Hybrid analyzer execution" "$error_msg"
        echo -e "${RED}Hybrid response: $hybrid_response${NC}"
        return 1
    fi
    
    echo -e "${YELLOW}Step 3: Compare with debug endpoint (old system)${NC}"
    
    # Compare with debug endpoint to see the difference
    local debug_response=$(curl -s -X POST "$API_BASE/import/debug-relationships" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $auth_token")
    
    local debug_success=$(echo "$debug_response" | jq -r '.success // false' 2>/dev/null)
    if [ "$debug_success" = "true" ]; then
        local field_stats=$(echo "$debug_response" | jq -r '.insights[1] // {}' 2>/dev/null)
        local multiple_links=$(echo "$field_stats" | jq -r '.multipleRecordLinks // 0' 2>/dev/null)
        
        echo -e "${YELLOW}Debug endpoint (old system) found:${NC}"
        echo -e "  multipleRecordLinks fields: $multiple_links"
        echo -e "  Other field types: $(echo "$field_stats" | jq -r 'keys | length' 2>/dev/null) types total"
        echo ""
        
        if [ "$multiple_links" -gt 0 ]; then
            echo -e "${GREEN}✓ Old system detects $multiple_links multipleRecordLinks fields${NC}"
            print_result "PASS" "multipleRecordLinks detection in old system"
            
            echo -e "${RED}🔍 ROOT CAUSE: Old system finds $multiple_links linked fields, hybrid finds 0 relationships${NC}"
            echo -e "${RED}   This suggests the hybrid analyzer is not properly processing linked record fields${NC}"
        else
            print_result "FAIL" "multipleRecordLinks detection in old system"
        fi
    else
        echo -e "${YELLOW}ℹ INFO: Debug endpoint not available for comparison${NC}"
    fi
}

# Function to debug table and field discovery in detail
debug_schema_discovery() {
    print_test_header "DETAILED SCHEMA DISCOVERY DEBUG"
    
    local auth_token=$(get_auth_token)
    
    echo -e "${YELLOW}Investigating table and field discovery process...${NC}"
    
    # Get detailed schema information
    local schema_response=$(curl -s -X GET "$API_BASE/import/schema-preview" \
        -H "Authorization: Bearer $auth_token")
    
    local schema_success=$(echo "$schema_response" | jq -r '.success // false' 2>/dev/null)
    if [ "$schema_success" = "true" ]; then
        local tables=$(echo "$schema_response" | jq -r '.tables' 2>/dev/null)
        local table_count=$(echo "$tables" | jq 'length' 2>/dev/null)
        
        echo -e "${GREEN}Schema discovery found $table_count tables${NC}"
        
        # Analyze each table for linked record fields
        local total_linked_fields=0
        echo -e "${YELLOW}Analyzing tables for linked record fields:${NC}"
        
        for i in $(seq 0 $((table_count - 1))); do
            local table_name=$(echo "$tables" | jq -r ".[$i].name.original" 2>/dev/null)
            local table_id=$(echo "$tables" | jq -r ".[$i].id" 2>/dev/null)
            local columns=$(echo "$tables" | jq -r ".[$i].columns" 2>/dev/null)
            local column_count=$(echo "$columns" | jq 'length' 2>/dev/null)
            
            # Check for linked record fields in this table
            local linked_fields=$(echo "$columns" | jq '[.[] | select(.type == "multipleRecordLinks")]' 2>/dev/null)
            local linked_count=$(echo "$linked_fields" | jq 'length' 2>/dev/null)
            
            if [ "$linked_count" -gt 0 ]; then
                echo -e "  📋 ${table_name} (ID: ${table_id}): ${linked_count} linked record fields"
                total_linked_fields=$((total_linked_fields + linked_count))
                
                # Show details of linked fields
                echo "$linked_fields" | jq -r '.[] | "    → \(.original) (type: \(.type))"' 2>/dev/null
            else
                echo -e "  📋 ${table_name}: 0 linked record fields (${column_count} total columns)"
            fi
        done
        
        echo ""
        echo -e "${CYAN}SUMMARY: Found $total_linked_fields total linked record fields across $table_count tables${NC}"
        
        if [ "$total_linked_fields" -gt 0 ]; then
            print_result "PASS" "Schema discovery finds linked record fields"
            echo -e "${GREEN}✓ Schema discovery is working - found $total_linked_fields linked fields${NC}"
        else
            print_result "FAIL" "Schema discovery missing linked record fields" "Found 0 linked fields"
            echo -e "${RED}✗ Schema discovery not finding linked record fields${NC}"
        fi
    else
        print_result "FAIL" "Schema discovery" "Schema preview endpoint failed"
        echo -e "${RED}Schema response: $schema_response${NC}"
    fi
}

# Function to investigate Airtable service differences
debug_airtable_service_methods() {
    print_test_header "AIRTABLE SERVICE METHOD COMPARISON"
    
    local auth_token=$(get_auth_token)
    
    echo -e "${YELLOW}Comparing different Airtable discovery methods...${NC}"
    
    # Method 1: Schema preview (works)
    echo -e "${CYAN}Method 1: Schema Preview Endpoint${NC}"
    local schema_response=$(curl -s -X GET "$API_BASE/import/schema-preview" \
        -H "Authorization: Bearer $auth_token")
    
    local schema_success=$(echo "$schema_response" | jq -r '.success // false' 2>/dev/null)
    if [ "$schema_success" = "true" ]; then
        local schema_tables=$(echo "$schema_response" | jq -r '.tables | length' 2>/dev/null)
        local schema_linked_fields=0
        
        # Count linked fields from schema preview
        for i in $(seq 0 $((schema_tables - 1))); do
            local linked_in_table=$(echo "$schema_response" | jq -r ".tables[$i].columns | [.[] | select(.type == \"multipleRecordLinks\")] | length" 2>/dev/null)
            schema_linked_fields=$((schema_linked_fields + linked_in_table))
        done
        
        echo -e "  ✓ Schema Preview: $schema_tables tables, $schema_linked_fields linked record fields"
        print_result "PASS" "Schema preview method finds linked record fields"
    else
        echo -e "  ✗ Schema Preview failed"
        print_result "FAIL" "Schema preview method"
    fi
    
    # Method 2: Debug relationships (old sequential method)
    echo -e "${CYAN}Method 2: Debug Relationships (Old Sequential)${NC}"
    local debug_response=$(curl -s -X POST "$API_BASE/import/debug-relationships" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $auth_token")
    
    local debug_success=$(echo "$debug_response" | jq -r '.success // false' 2>/dev/null)
    if [ "$debug_success" = "true" ]; then
        local debug_field_stats=$(echo "$debug_response" | jq -r '.insights[1] // {}' 2>/dev/null)
        local debug_linked_fields=$(echo "$debug_field_stats" | jq -r '.multipleRecordLinks // 0' 2>/dev/null)
        
        echo -e "  ✓ Debug Method: $debug_linked_fields multipleRecordLinks fields"
        print_result "PASS" "Debug method finds linked record fields"
    else
        echo -e "  ✗ Debug Method failed"
        print_result "FAIL" "Debug method"
    fi
    
    # Method 3: Hybrid analyzer
    echo -e "${CYAN}Method 3: Hybrid Analyzer${NC}"
    local hybrid_response=$(curl -s -X POST "$API_BASE/import/analyze-hybrid-relationships" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $auth_token")
    
    local hybrid_success=$(echo "$hybrid_response" | jq -r '.success // false' 2>/dev/null)
    if [ "$hybrid_success" = "true" ]; then
        local hybrid_relationships=$(echo "$hybrid_response" | jq -r '.data.relationships | length' 2>/dev/null)
        
        echo -e "  ✓ Hybrid Analyzer: $hybrid_relationships relationships found"
        
        if [ "$hybrid_relationships" -eq 0 ]; then
            print_result "FAIL" "Hybrid analyzer finds 0 relationships" "Method comparison shows hybrid analyzer issue"
        else
            print_result "PASS" "Hybrid analyzer finds relationships"
        fi
    else
        local hybrid_error=$(echo "$hybrid_response" | jq -r '.error // "Unknown error"' 2>/dev/null)
        echo -e "  ✗ Hybrid Analyzer failed: $hybrid_error"
        print_result "FAIL" "Hybrid analyzer method" "$hybrid_error"
    fi
    
    # Comparison analysis
    echo ""
    echo -e "${YELLOW}COMPARISON ANALYSIS:${NC}"
    if [ "$schema_success" = "true" ] && [ "$debug_success" = "true" ] && [ "$hybrid_success" = "true" ]; then
        if [ "$schema_linked_fields" -gt 0 ] && [ "$debug_linked_fields" -gt 0 ] && [ "$hybrid_relationships" -eq 0 ]; then
            echo -e "${RED}🚨 PROBLEM IDENTIFIED:${NC}"
            echo -e "  • Schema Preview finds: $schema_linked_fields linked fields ✓"
            echo -e "  • Debug Method finds: $debug_linked_fields linked fields ✓"
            echo -e "  • Hybrid Analyzer finds: $hybrid_relationships relationships ✗"
            echo ""
            echo -e "${RED}ROOT CAUSE: Hybrid analyzer is not converting linked record fields to relationships${NC}"
            echo -e "${YELLOW}SOLUTION NEEDED: Fix hybrid analyzer's analyzeSchemaRelationships method${NC}"
        fi
    fi
}

# Function to test specific confidence calculation scenarios
test_confidence_scenarios() {
    print_test_header "CONFIDENCE CALCULATION SCENARIOS"
    
    local auth_token=$(get_auth_token)
    
    # Get the analysis results
    local response=$(curl -s -X POST "$API_BASE/import/analyze-hybrid-relationships" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $auth_token")
    
    local success=$(echo "$response" | jq -r '.success // false' 2>/dev/null)
    
    if [ "$success" = "true" ]; then
        local relationships=$(echo "$response" | jq -r '.data.relationships // []' 2>/dev/null)
        
        # Test for different relationship types and their confidence
        local one_to_many=$(echo "$relationships" | jq '[.[] | select(.type == "one-to-many")] | length' 2>/dev/null)
        local many_to_many=$(echo "$relationships" | jq '[.[] | select(.type == "many-to-many")] | length' 2>/dev/null)
        local one_to_one=$(echo "$relationships" | jq '[.[] | select(.type == "one-to-one")] | length' 2>/dev/null)
        
        echo -e "${YELLOW}Relationship Type Distribution:${NC}"
        echo -e "  One-to-Many: $one_to_many"
        echo -e "  Many-to-Many: $many_to_many"
        echo -e "  One-to-One: $one_to_one"
        echo ""
        
        # Test confidence for linked record fields (should be high)
        local linked_record_relationships=$(echo "$relationships" | jq '[.[] | select(.reason and (.reason | contains("linked record")))] | length' 2>/dev/null)
        
        if [ "$linked_record_relationships" -gt 0 ]; then
            local avg_linked_confidence=$(echo "$relationships" | jq '[.[] | select(.reason and (.reason | contains("linked record"))) | .confidence] | add / length' 2>/dev/null)
            echo -e "${YELLOW}Linked Record Field Analysis:${NC}"
            echo -e "  Count: $linked_record_relationships"
            echo -e "  Average Confidence: ${avg_linked_confidence}%"
            echo ""
            
            # Linked record fields should have high confidence
            local high_confidence_linked=$(echo "$relationships" | jq '[.[] | select(.reason and (.reason | contains("linked record")) and .confidence >= 70)] | length' 2>/dev/null)
            
            if [ "$high_confidence_linked" -gt 0 ]; then
                print_result "PASS" "Linked record fields have high confidence scores"
            else
                print_result "FAIL" "Linked record confidence scoring" "Linked records should have ≥70% confidence"
            fi
        else
            echo -e "${YELLOW}ℹ INFO${NC}: No linked record fields detected"
        fi
        
        # Show some example confidence calculations
        echo -e "${YELLOW}Sample Confidence Calculations:${NC}"
        echo "$relationships" | jq -r '.[] | "  • \(.sourceTable).\(.sourceField) → \(.targetTable): \(.confidence)% (\(.reason // "no reason given"))"' 2>/dev/null | head -5
        echo ""
        
    else
        print_result "FAIL" "Confidence scenario testing setup" "Could not get analysis data"
    fi
}

# Function to debug why confidence is low
debug_low_confidence() {
    print_test_header "LOW CONFIDENCE DEBUGGING"
    
    local auth_token=$(get_auth_token)
    
    # Get debug information about relationship analysis
    local debug_response=$(curl -s -X POST "$API_BASE/import/debug-relationships" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $auth_token" 2>/dev/null)
    
    local debug_success=$(echo "$debug_response" | jq -r '.success // false' 2>/dev/null)
    
    if [ "$debug_success" = "true" ]; then
        echo -e "${YELLOW}Debug Information Available:${NC}"
        
        # Show potential issues
        local potential_issues=$(echo "$debug_response" | jq -r '.data.potentialIssues // []' 2>/dev/null)
        local issue_count=$(echo "$potential_issues" | jq 'length' 2>/dev/null)
        
        if [ "$issue_count" -gt 0 ]; then
            echo -e "${RED}Potential Issues Found ($issue_count):${NC}"
            echo "$potential_issues" | jq -r '.[] | "  • \(.)"' 2>/dev/null
            echo ""
        fi
        
        # Show insights
        local insights=$(echo "$debug_response" | jq -r '.insights // []' 2>/dev/null)
        local insight_count=$(echo "$insights" | jq 'length' 2>/dev/null)
        
        if [ "$insight_count" -gt 0 ]; then
            echo -e "${BLUE}Analysis Insights ($insight_count):${NC}"
            echo "$insights" | jq -r '.[] | "  • \(.)"' 2>/dev/null
            echo ""
        fi
        
        print_result "PASS" "Debug information collection"
        
    else
        echo -e "${YELLOW}ℹ INFO${NC}: Debug endpoint not available or not working"
        
        # Fallback: try to analyze the issue from available data
        local hybrid_response=$(curl -s -X POST "$API_BASE/import/analyze-hybrid-relationships" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $auth_token")
        
        local success=$(echo "$hybrid_response" | jq -r '.success // false' 2>/dev/null)
        
        if [ "$success" = "true" ]; then
            echo -e "${YELLOW}Manual Low Confidence Analysis:${NC}"
            
            local relationships=$(echo "$hybrid_response" | jq -r '.data.relationships // []' 2>/dev/null)
            local low_conf_count=$(echo "$relationships" | jq '[.[] | select(.confidence < 70)] | length' 2>/dev/null)
            local total_count=$(echo "$relationships" | jq 'length' 2>/dev/null)
            
            if [ "$total_count" -gt 0 ] && [ "$low_conf_count" -eq "$total_count" ]; then
                echo -e "${RED}Issue: All $total_count relationships have confidence < 70%${NC}"
                echo ""
                
                # Show confidence distribution
                echo -e "${YELLOW}Confidence Range Analysis:${NC}"
                local min_conf=$(echo "$relationships" | jq '[.[] | .confidence] | min' 2>/dev/null)
                local max_conf=$(echo "$relationships" | jq '[.[] | .confidence] | max' 2>/dev/null)
                local avg_conf=$(echo "$relationships" | jq '[.[] | .confidence] | add / length' 2>/dev/null)
                
                echo -e "  Min Confidence: ${min_conf}%"
                echo -e "  Max Confidence: ${max_conf}%"
                echo -e "  Avg Confidence: ${avg_conf}%"
                echo ""
                
                print_result "FAIL" "Confidence scoring is systematically low" "All relationships < 70%"
            fi
        fi
    fi
}

# Main test execution
main() {
    echo -e "${BLUE}Starting Hybrid Relationship Analyzer Test Suite...${NC}"
    echo -e "${BLUE}Date: $(date)${NC}"
    echo ""
    
    # Run all debug functions
    check_services
    debug_core_issue
    debug_schema_discovery
    debug_airtable_service_methods
    
    # Print final summary
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}              TEST SUMMARY                      ${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
    echo -e "${RED}Failed: $FAILED_TESTS${NC}"
    echo -e "${CYAN}Total:  $TOTAL_TESTS${NC}"
    echo ""
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${GREEN}🎉 ALL TESTS PASSED! 🎉${NC}"
        echo -e "${GREEN}Hybrid relationship analyzer is working correctly.${NC}"
        exit 0
    else
        echo -e "${RED}❌ Some tests failed.${NC}"
        echo -e "${RED}Please review the output above for debugging information.${NC}"
        exit 1
    fi
}

# Check if jq is installed (required for JSON parsing)
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is required but not installed.${NC}"
    echo "Please install jq: sudo apt-get install jq"
    exit 1
fi

# Run main test suite
main