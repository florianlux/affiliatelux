#!/bin/bash
# Newsletter Bug Fix - Verification Tests
# Run these after deployment to verify the fix works

set -e

API_BASE="https://dropcharge.netlify.app"
ADMIN_TOKEN="${ADMIN_TOKEN:-your-admin-token-here}"
TEST_EMAIL="test-$(date +%s)@example.com"

echo "🧪 Newsletter Signup Bug Fix Verification"
echo "=========================================="
echo ""

# Test 1: Signup (Happy Path)
echo "Test 1: POST /subscribe (new subscriber)"
RESPONSE=$(curl -s -X POST "$API_BASE/.netlify/functions/subscribe" \
  -H "Content-Type: application/json" \
  -H "Origin: https://dropcharge.io" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"source\": \"popup\",
    \"page\": \"/\",
    \"utm\": {
      \"utm_source\": \"test\",
      \"utm_campaign\": \"verification\"
    }
  }")

echo "Response: $RESPONSE"
OK=$(echo "$RESPONSE" | grep -o '"ok":true' || echo "FAILED")
if [ "$OK" == '"ok":true' ]; then
  echo "✅ Signup successful"
else
  echo "❌ Signup failed"
  exit 1
fi
echo ""

# Test 2: Duplicate signup (should return already_subscribed)
echo "Test 2: POST /subscribe (duplicate)"
RESPONSE=$(curl -s -X POST "$API_BASE/.netlify/functions/subscribe" \
  -H "Content-Type: application/json" \
  -H "Origin: https://dropcharge.io" \
  -d "{\"email\": \"$TEST_EMAIL\"}")

echo "Response: $RESPONSE"
MSG=$(echo "$RESPONSE" | grep -o '"message":"already_subscribed"' || echo "MISSING")
if [ "$MSG" == '"message":"already_subscribed"' ]; then
  echo "✅ Duplicate handling works"
else
  echo "❌ Duplicate handling broken"
fi
echo ""

# Test 3: Invalid email
echo "Test 3: POST /subscribe (invalid email)"
RESPONSE=$(curl -s -X POST "$API_BASE/.netlify/functions/subscribe" \
  -H "Content-Type: application/json" \
  -H "Origin: https://dropcharge.io" \
  -d "{\"email\": \"notanemail\"}")

echo "Response: $RESPONSE"
ERROR=$(echo "$RESPONSE" | grep -o '"error":"invalid_email"' || echo "MISSING")
if [ "$ERROR" == '"error":"invalid_email"' ]; then
  echo "✅ Email validation works"
else
  echo "❌ Email validation broken"
fi
echo ""

# Test 4: CORS Preflight
echo "Test 4: OPTIONS preflight request"
RESPONSE=$(curl -s -i -X OPTIONS "$API_BASE/.netlify/functions/subscribe" \
  -H "Origin: https://dropcharge.io" \
  -H "Access-Control-Request-Method: POST")

CORS=$(echo "$RESPONSE" | grep -i "Access-Control-Allow-Origin" || echo "MISSING")
if [ "$CORS" != "MISSING" ]; then
  echo "✅ CORS headers present"
  echo "Header: $CORS"
else
  echo "❌ CORS headers missing"
fi
echo ""

# Test 5: Admin Stats (requires token)
echo "Test 5: GET /stats (requires admin token)"
if [ "$ADMIN_TOKEN" != "your-admin-token-here" ]; then
  RESPONSE=$(curl -s -X GET "$API_BASE/.netlify/functions/stats" \
    -H "x-admin-token: $ADMIN_TOKEN")
  
  EMAIL_COUNT=$(echo "$RESPONSE" | grep -o '"emailCount":[0-9]*' | head -1)
  if [ ! -z "$EMAIL_COUNT" ]; then
    echo "✅ Stats endpoint working"
    echo "Response includes: $EMAIL_COUNT"
  else
    echo "⚠️  Stats endpoint error (check token)"
    echo "$RESPONSE"
  fi
else
  echo "⏭️  Skipped (set ADMIN_TOKEN env var)"
fi
echo ""

echo "=========================================="
echo "All tests completed!"
echo ""
echo "Next steps:"
echo "1. Check https://dropchargeadmin.netlify.app"
echo "2. Verify '$TEST_EMAIL' appears in Email Stats table"
echo "3. Check status shows '✓ Active' (not 'Confirmed' or error)"
echo "4. Monitor Netlify Functions logs for errors (24h)"
