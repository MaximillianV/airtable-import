#!/bin/bash

# Simple curl command to test Airtable Metadata API
# Replace YOUR_API_KEY and YOUR_BASE_ID with your actual values

echo "🔍 Direct Airtable Schema Test"
echo "============================="
echo ""
echo "Please replace YOUR_API_KEY and YOUR_BASE_ID with your actual values:"
echo ""
echo "COMMAND:"
echo 'curl "https://api.airtable.com/v0/meta/bases/YOUR_BASE_ID/tables" \\'
echo '  -H "Authorization: Bearer YOUR_API_KEY" \\'
echo '  -H "Content-Type: application/json" | jq .'
echo ""
echo "EXAMPLE:"
echo 'curl "https://api.airtable.com/v0/meta/bases/appkj2fWXmFXFdMJE/tables" \\'
echo '  -H "Authorization: Bearer pat1234567890abcdef" \\'
echo '  -H "Content-Type: application/json" | jq .'
echo ""
echo "This will show you:"
echo "1. All tables in your base with their IDs"
echo "2. All fields in each table including linked record fields"
echo "3. Which linkedTableId each linked record field points to"
echo ""
echo "Look for:"
echo "- A table with the name 'Contact' (or similar)"
echo "- Whether the ID 'tblbg7W8lk6EEEzPz' appears anywhere in the response"
echo "- What the Subscriptions table's Contact field is actually pointing to"