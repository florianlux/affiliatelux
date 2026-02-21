#!/bin/bash
# Quick Reference: Commands to Deploy the Newsletter Bug Fix

echo "🚀 NEWSLETTER SIGNUP BUG FIX - DEPLOYMENT COMMANDS"
echo "=================================================="
echo ""

echo "STEP 1: Verify all files are changed"
echo "───────────────────────────────────"
echo "$ git status"
echo ""
echo "Expected output:"
echo "  M netlify/functions/subscribe.js"
echo "  M netlify/functions/stats.js"
echo "  M assets/admin-dashboard.js"
echo ""

echo "STEP 2: Review the changes"
echo "─────────────────────────"
echo "$ git diff netlify/functions/subscribe.js"
echo "$ git diff netlify/functions/stats.js"
echo "$ git diff assets/admin-dashboard.js"
echo ""

echo "STEP 3: Stage changes"
echo "────────────────────"
echo "$ git add netlify/functions/subscribe.js netlify/functions/stats.js assets/admin-dashboard.js"
echo ""

echo "STEP 4: Commit with proper message"
echo "──────────────────────────────────"
echo "$ git commit -F GIT_COMMIT_MSG.txt"
echo ""
echo "Or manually:"
echo "$ git commit -m 'fix: newsletter signup - schema mismatch + syntax error'"
echo ""

echo "STEP 5: Push to deploy"
echo "─────────────────────"
echo "$ git push origin main"
echo ""

echo "STEP 6: Wait for Netlify build (1-2 minutes)"
echo "────────────────────────────────────────────"
echo "$ open https://app.netlify.com/sites/dropcharge/deploys"
echo ""

echo "STEP 7: Run automated tests"
echo "──────────────────────────"
echo "$ bash test-newsletter-fix.sh"
echo ""

echo "STEP 8: Manual smoke test"
echo "────────────────────────"
echo "1. Visit: https://dropcharge.io"
echo "2. Wait for popup or scroll down"
echo "3. Enter email, click 'Deals sichern'"
echo "4. Should see: 'Danke! Deals landen im Postfach.'"
echo "5. Visit: https://dropchargeadmin.netlify.app"
echo "6. Login and check 'Email Stats' section"
echo "7. Should see your test email with status '✓ Active'"
echo ""

echo "STEP 9: If problems, rollback"
echo "────────────────────────────"
echo "$ git log --oneline | head -3"
echo "$ git revert <commit-hash-of-this-fix>"
echo "$ git push origin main"
echo ""

echo "=================================================="
echo "All done! Newsletter signup is fixed. 🎉"
echo ""

# Quick inline tests
echo ""
echo "QUICK INLINE TESTS (without running full script):"
echo "──────────────────────────────────────────────────"
echo ""

echo "Test 1: Signup works"
echo "$ curl -s -X POST https://dropcharge.netlify.app/.netlify/functions/subscribe \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -H 'Origin: https://dropcharge.io' \\"
echo "    -d '{\"email\":\"test'$(date +%s)'@example.com\"}' | grep -o '\"ok\":true'"
echo ""

echo "Expected: \"ok\":true"
echo ""

echo "Test 2: CORS works"
echo "$ curl -s -i -X OPTIONS https://dropcharge.netlify.app/.netlify/functions/subscribe \\"
echo "    -H 'Origin: https://dropcharge.io' | grep -i Access-Control-Allow-Origin"
echo ""

echo "Expected: Access-Control-Allow-Origin: https://dropcharge.io"
echo ""

echo "Test 3: Check logs"
echo "$ open https://app.netlify.com/sites/dropcharge/functions"
echo ""

echo "Look for: '[subscribe] Processing request: { method: POST }'"
echo "No errors about 'Supabase not configured'"
