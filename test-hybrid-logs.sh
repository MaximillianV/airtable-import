#!/bin/bash

# Simple test to see hybrid analyzer logs
echo "Testing hybrid analyzer with detailed logging..."

# Get auth token
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}' | jq -r '.token')

echo "Got token: ${TOKEN:0:20}..."

# Call hybrid analyzer and ignore output to see backend logs
echo "Calling hybrid analyzer endpoint..."
curl -s -X POST http://localhost:3001/api/import/analyze-hybrid-relationships \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" > /dev/null

echo "Request completed. Check backend terminal for detailed logs."