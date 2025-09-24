#!/bin/bash

# Get actual Airtable credentials and make the API call
echo "🔍 Extracting Airtable credentials and making API call..."

# Get JWT token
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@example.com","password":"admin123"}' | jq -r '.token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
    echo "❌ Failed to get authentication token"
    exit 1
fi

echo "✅ Got authentication token"

# Get the actual credentials by making a call that returns them
# We'll use the debug endpoint we created to get the raw response
echo "📡 Making API call through our backend to get raw schema..."

RESPONSE=$(curl -s -X POST http://localhost:3001/api/import/debug-relationships \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN")

echo "Backend response:"
echo "$RESPONSE" | jq .

# Also try getting settings to see the base ID
echo ""
echo "📋 User settings:"
curl -s -X GET http://localhost:3001/api/settings \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" | jq .

# Let's also try to get the raw metadata through a different endpoint
echo ""
echo "🔍 Let me create a direct metadata endpoint..."