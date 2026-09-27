#!/bin/bash

# Test API Script
# Run the server first with: npm run dev

BASE_URL="http://localhost:3000"

echo "=== Testing Shop Backend API ==="
echo ""

echo "1. Health Check"
curl -s "$BASE_URL/health" | json_pp
echo ""

echo "2. Get All Themes"
curl -s "$BASE_URL/shop/themes" | json_pp
echo ""

echo "3. Get Skin Themes Only"
curl -s "$BASE_URL/shop/themes?type=skin" | json_pp
echo ""

echo "4. Purchase Single Theme"
curl -s -X POST "$BASE_URL/shop/purchase" \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-1","themeIds":["skin-1"]}' | json_pp
echo ""

echo "5. Purchase Multiple Themes (Bulk)"
curl -s -X POST "$BASE_URL/shop/purchase" \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-1","themeIds":["board-1","board-2"]}' | json_pp
echo ""

echo "6. Purchase with Coupon (20% off)"
curl -s -X POST "$BASE_URL/shop/purchase" \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-1","themeIds":["skin-2"],"couponCode":"WELCOME20"}' | json_pp
echo ""

echo "7. Get User Transactions"
curl -s "$BASE_URL/shop/transactions/user-1" | json_pp
echo ""

echo "=== Tests Complete ==="
