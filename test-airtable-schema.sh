#!/bin/bash

# Test script to get raw Airtable schema response
# This will help us debug the missing table ID issue

echo "🔍 Airtable Schema Debug Test"
echo "================================"

# Check if we have the required environment variables or settings
if [ -f ".env" ]; then
    source .env
fi

# Try to get credentials from the database settings (requires the backend to be running)
if [ -z "$AIRTABLE_API_KEY" ] || [ -z "$AIRTABLE_BASE_ID" ]; then
    echo "⚠️  Environment variables not set, trying to get from user settings via API..."
    
    # Get JWT token
    TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
        -H "Content-Type: application/json" \
        -d '{"email":"admin@example.com","password":"admin123"}' | jq -r '.token')
    
    if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
        echo "❌ Failed to get authentication token"
        echo "Please make sure:"
        echo "1. Backend server is running (./start-all.sh)"
        echo "2. You have configured Airtable settings in the app"
        echo "3. Or set AIRTABLE_API_KEY and AIRTABLE_BASE_ID environment variables"
        exit 1
    fi
    
    echo "✅ Got authentication token"
    
    # Get user settings to extract Airtable credentials
    SETTINGS_RESPONSE=$(curl -s -X GET http://localhost:3001/api/settings \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json")
    
    AIRTABLE_API_KEY=$(echo "$SETTINGS_RESPONSE" | jq -r '.airtableApiKey // empty')
    AIRTABLE_BASE_ID=$(echo "$SETTINGS_RESPONSE" | jq -r '.airtableBaseId // empty')
fi

# Verify we have the credentials
if [ -z "$AIRTABLE_API_KEY" ] || [ -z "$AIRTABLE_BASE_ID" ]; then
    echo "❌ Could not find Airtable credentials"
    echo "Please configure them in the app Settings or set environment variables:"
    echo "export AIRTABLE_API_KEY='your_api_key'"
    echo "export AIRTABLE_BASE_ID='your_base_id'"
    exit 1
fi

echo "✅ Found Airtable credentials:"
echo "   API Key: ${AIRTABLE_API_KEY:0:10}... (${#AIRTABLE_API_KEY} chars)"
echo "   Base ID: $AIRTABLE_BASE_ID"
echo ""

# Make the direct API call to Airtable Metadata API
echo "📡 Making API call to Airtable Metadata API..."
echo "URL: https://api.airtable.com/v0/meta/bases/$AIRTABLE_BASE_ID/tables"
echo ""

RESPONSE=$(curl -s "https://api.airtable.com/v0/meta/bases/$AIRTABLE_BASE_ID/tables" \
    -H "Authorization: Bearer $AIRTABLE_API_KEY" \
    -H "Content-Type: application/json")

# Check if the response is valid JSON
if echo "$RESPONSE" | jq . > /dev/null 2>&1; then
    echo "✅ Valid JSON response received"
    echo ""
    
    # Pretty print the response
    echo "📋 RAW AIRTABLE SCHEMA RESPONSE:"
    echo "==============================="
    echo "$RESPONSE" | jq .
    echo ""
    
    # Extract and analyze table information
    echo "📊 ANALYSIS:"
    echo "============"
    
    TABLE_COUNT=$(echo "$RESPONSE" | jq '.tables | length')
    echo "Total tables: $TABLE_COUNT"
    echo ""
    
    echo "📋 Available Tables:"
    echo "$RESPONSE" | jq -r '.tables[] | "   \(.name) (ID: \(.id)) - \(.fields | length) fields"'
    echo ""
    
    echo "🔗 Linked Record Fields:"
    echo "$RESPONSE" | jq -r '.tables[] as $table | $table.fields[] | select(.type == "multipleRecordLinks" or .type == "singleRecordLink") | "   \($table.name).\(.name) → linkedTableId: \(.options.linkedTableId // "none")"'
    echo ""
    
    # Check for missing table references
    echo "🎯 Checking for missing table references..."
    
    # Get all available table IDs
    AVAILABLE_IDS=$(echo "$RESPONSE" | jq -r '.tables[].id' | sort)
    
    # Get all referenced table IDs from linked fields
    REFERENCED_IDS=$(echo "$RESPONSE" | jq -r '.tables[].fields[]? | select(.type == "multipleRecordLinks" or .type == "singleRecordLink") | .options.linkedTableId // empty' | sort | uniq)
    
    echo "Available table IDs:"
    echo "$AVAILABLE_IDS" | sed 's/^/   /'
    echo ""
    
    echo "Referenced table IDs from linked fields:"
    echo "$REFERENCED_IDS" | sed 's/^/   /'
    echo ""
    
    # Find missing references
    MISSING_IDS=""
    for ref_id in $REFERENCED_IDS; do
        if ! echo "$AVAILABLE_IDS" | grep -q "^$ref_id$"; then
            MISSING_IDS="$MISSING_IDS $ref_id"
        fi
    done
    
    if [ -n "$MISSING_IDS" ]; then
        echo "⚠️  MISSING TABLE IDS (referenced but not available):"
        for missing_id in $MISSING_IDS; do
            echo "   $missing_id"
            # Show which fields reference this missing table
            echo "$RESPONSE" | jq -r --arg missing_id "$missing_id" '.tables[] as $table | $table.fields[] | select((.type == "multipleRecordLinks" or .type == "singleRecordLink") and .options.linkedTableId == $missing_id) | "      ↳ Referenced by: \($table.name).\(.name)"'
        done
        echo ""
        echo "💡 This explains why the relationship detector can't find these tables!"
    else
        echo "✅ All referenced table IDs are available"
    fi
    
else
    echo "❌ Invalid JSON response or API error:"
    echo "$RESPONSE"
    
    # Check for common error patterns
    if echo "$RESPONSE" | grep -q "INVALID_CREDENTIALS"; then
        echo ""
        echo "💡 This looks like an authentication error. Check your API key."
    elif echo "$RESPONSE" | grep -q "NOT_FOUND"; then
        echo ""
        echo "💡 This looks like the base ID is incorrect or you don't have access."
    fi
fi

echo ""
echo "🔍 Debug complete!"