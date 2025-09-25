#!/bin/bash

echo "🔍 Testing Hybrid Relationship Analyzer - Confidence Score Analysis"
echo "=================================================================="

# Get authentication token
echo "🔑 Authenticating..."
TOKEN_RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}')

TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.token // empty')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ Failed to get authentication token"
  echo "Response: $TOKEN_RESPONSE"
  exit 1
fi

echo "✅ Authentication successful"

# Call hybrid analyzer endpoint and capture results
echo ""
echo "🧪 Running Hybrid Relationship Analysis..."
RESPONSE=$(curl -s -X POST http://localhost:3001/api/import/analyze-hybrid-relationships \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

# Check if request was successful
if [ $? -ne 0 ]; then
  echo "❌ Request failed"
  exit 1
fi

echo "✅ Analysis completed"
echo ""

# Parse and display results
echo "📊 ANALYSIS RESULTS"
echo "==================="

# Overall statistics
echo "$RESPONSE" | jq -r '
if .success then
  "✅ Success: " + (.message // "Analysis completed")
else
  "❌ Error: " + (.error // "Unknown error")
end'

echo ""
echo "📈 SUMMARY STATISTICS"
echo "--------------------"
echo "$RESPONSE" | jq -r '
if .data.analysis then
  .data.analysis | 
  "Total Relationships: " + (.schemaBasedCount // 0 | tostring) + "\n" +
  "Data Enhanced: " + (.dataEnhancedCount // 0 | tostring) + "\n" +
  "High Confidence: " + (.highConfidenceCount // 0 | tostring) + "\n" +
  "Low Confidence: " + (.lowConfidenceCount // 0 | tostring)
else
  "No analysis data available"
end'

echo ""
echo "🎯 CONFIDENCE BREAKDOWN"
echo "----------------------"
echo "$RESPONSE" | jq -r '
if .data.relationships then
  .data.relationships | 
  group_by(.confidence | floor * 10 / 10) |
  map({
    confidence_range: (.[0].confidence | floor * 10 / 10 | tostring),
    count: length,
    examples: map(.sourceTable + "." + .sourceField + " -> " + .targetTable)[0:3]
  }) |
  sort_by(.confidence_range) |
  reverse |
  map(
    "Confidence " + .confidence_range + "+: " + (.count | tostring) + " relationships" +
    (if .count > 0 then "\n  Examples: " + (.examples | join(", ")) else "" end)
  ) |
  join("\n")
else
  "No relationship data available"
end'

echo ""
echo "🔝 TOP 10 HIGHEST CONFIDENCE RELATIONSHIPS"
echo "==========================================="
echo "$RESPONSE" | jq -r '
if .data.relationships then
  .data.relationships |
  sort_by(.confidence) |
  reverse |
  .[0:10] |
  map(
    (.confidence * 100 | floor | tostring) + "% - " +
    .sourceTable + "." + .sourceField + " -> " + .targetTable +
    " (" + .type + ")" +
    (if .hybridAnalysis then " [Enhanced]" else " [Schema-only]" end)
  ) |
  join("\n")
else
  "No relationship data available"
end'

echo ""
echo "⚠️  LOW CONFIDENCE RELATIONSHIPS (< 70%)"
echo "========================================"
echo "$RESPONSE" | jq -r '
if .data.relationships then
  .data.relationships |
  map(select(.confidence < 0.7)) |
  sort_by(.confidence) |
  reverse |
  if length > 0 then
    map(
      (.confidence * 100 | floor | tostring) + "% - " +
      .sourceTable + "." + .sourceField + " -> " + .targetTable +
      " (" + .type + ")"
    ) |
    join("\n")
  else
    "🎉 All relationships have high confidence (70%+)!"
  end
else
  "No relationship data available"
end'

echo ""
echo "💾 Raw JSON saved to: /tmp/hybrid_analysis_results.json"
echo "$RESPONSE" > /tmp/hybrid_analysis_results.json

echo ""
echo "🔍 For detailed analysis, check:"
echo "  - Backend logs: ./view-logs.sh backend"
echo "  - Raw results: cat /tmp/hybrid_analysis_results.json | jq ."