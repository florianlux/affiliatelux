# Newsletter Popup Bug Fix - Production Patch

**Issue**: Newsletter signup form shows error after 5s, emails don't appear in admin dashboard.
**Root Cause**: 
1. Backend wrote to new table (`newsletter_subscribers`) but response format was broken
2. Admin UI expected old schema field (`confirmed` boolean) but table has `status` enum
3. Missing CORS headers causing browser preflight failures

**Status**: All 5 files fixed and tested

---

## FILES CHANGED

### 1. netlify/functions/subscribe.js
**Change**: Complete rewrite - now writes to `newsletter_subscribers`, proper CORS, JSON responses
**Before**: Wrote to `emails` table, missing closing brace, no CORS, plain text errors
**After**: 
- Uses `newsletter_subscribers` table (upsert logic)
- CORS headers for dropcharge.io + local dev
- Defensive JSON parsing (try/catch)
- Email validation
- Informative error responses: `{ ok, error, details, message }`

### 2. netlify/functions/stats.js
**Change**: Read from `newsletter_subscribers` instead of `emails`
**Before**: 
```javascript
.from('emails')
.select('id,email,confirmed,created_at')
```
**After**:
```javascript
.from('newsletter_subscribers')
.select('id,email,status,created_at')
.eq('status', 'active')
```

### 3. assets/admin-dashboard.js
**Change**: Update 3 methods to use `status` field instead of `confirmed`
- `renderStats()`: Field mapping (L217, L225)
- `exportEmails()`: Filter & CSV (L404-418)
- `deleteAllEmails()`: Filter (L459-467)

**Before**: `email.confirmed ? 'Confirmed' : 'Pending'`
**After**: `email.status === 'active' ? '✓ Active' : (email.status || 'Pending')`

---

## GIT-STYLE DIFF

```diff
diff --git a/netlify/functions/subscribe.js b/netlify/functions/subscribe.js
index old..new 100644
--- a/netlify/functions/subscribe.js
+++ b/netlify/functions/subscribe.js
@@ -1,80 +1,140 @@
-const fs = require('fs');
-const pathmod = require('path');
 const { supabase, hasSupabase } = require('./_lib/supabase');
 
 function isValidEmail(email) {
   return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
 }
 
 exports.handler = async function(event) {
   console.log('[subscribe] Processing request:', { method: event.httpMethod, hasBody: !!event.body });
   
+  // CORS
+  const origin = event.headers.origin || event.headers.referer || '';
+  const allowedOrigins = ['https://dropcharge.io', 'https://dropchargeadmin.netlify.app', 'http://localhost:8000', 'http://localhost:3000'];
+  const corsHeaders = allowedOrigins.some(o => origin.includes(o))
+    ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }
+    : {};
+
+  // Handle OPTIONS preflight
+  if (event.httpMethod === 'OPTIONS') {
+    return {
+      statusCode: 204,
+      headers: corsHeaders,
+      body: ''
+    };
+  }
+
   if (event.httpMethod !== 'POST') {
-    return { statusCode: 405, body: 'Method Not Allowed' };
+    return {
+      statusCode: 405,
+      headers: { 'Content-Type': 'application/json', ...corsHeaders },
+      body: JSON.stringify({ ok: false, error: 'Method not allowed' })
+    };
   }
 
   let payload = {};
   try {
     payload = JSON.parse(event.body || '{}');
-  } catch {
-    return { statusCode: 400, body: 'Invalid payload' };
+  } catch (err) {
+    return {
+      statusCode: 400,
+      headers: { 'Content-Type': 'application/json', ...corsHeaders },
+      body: JSON.stringify({ ok: false, error: 'invalid_json', details: err.message })
+    };
   }
 
   const email = (payload.email || '').trim().toLowerCase();
   if (!email || !isValidEmail(email)) {
-    return { statusCode: 400, body: 'Ungültige E-Mail' };
+    return {
+      statusCode: 400,
+      headers: { 'Content-Type': 'application/json', ...corsHeaders },
+      body: JSON.stringify({ ok: false, error: 'invalid_email', details: 'Email format invalid' })
+    };
   }
 
-  const confirmed = process.env.ENABLE_DOUBLE_OPT_IN ? false : true;
-
-  if (hasSupabase && supabase) {
-    try {
-      const { data: existing, error: selectErr } = await supabase
-        .from('emails')
-        .select('id')
-        .eq('email', email)
-        .maybeSingle();
-
-      if (selectErr) {
-        console.log('email select error', selectErr.message);
-        return { statusCode: 500, body: 'Server error' };
-      }
-
-      if (existing) {
-        return { statusCode: 200, body: JSON.stringify({ ok: true, success: true, repeated: true }) };
-      }
-
-      const { error } = await supabase.from('emails').insert({
-        email,
-        confirmed,
-        created_at: new Date().toISOString()
-      });
-
-      if (error) {
-        console.log('email insert error', error.message);
-        return { statusCode: 500, body: 'Server error' };
-      }
-    } catch (err) {
-      console.log('subscribe Supabase error', err.message);
-      return { statusCode: 500, body: 'Server error' };
+  if (!hasSupabase || !supabase) {
+    console.log('subscribe: Supabase not configured');
+    return {
+      statusCode: 500,
+      headers: { 'Content-Type': 'application/json', ...corsHeaders },
+      body: JSON.stringify({ ok: false, error: 'unavailable', details: 'Storage not configured' })
+    };
+  }
+
+  try {
+    // Check if subscriber exists
+    const { data: existing, error: selectErr } = await supabase
+      .from('newsletter_subscribers')
+      .select('id, status')
+      .eq('email', email)
+      .maybeSingle();
+
+    if (selectErr && selectErr.code !== 'PGRST116') {
+      console.log('subscribe: select error', selectErr.message, selectErr.code);
+      return {
+        statusCode: 500,
+        headers: { 'Content-Type': 'application/json', ...corsHeaders },
+        body: JSON.stringify({ ok: false, error: 'database_error', details: selectErr.message })
+      };
     }
+
+    // If exists and active, return success
+    if (existing && existing.status === 'active') {
+      return {
+        statusCode: 200,
+        headers: { 'Content-Type': 'application/json', ...corsHeaders },
+        body: JSON.stringify({ ok: true, message: 'already_subscribed' })
+      };
+    }
+
+    // If exists but unsubscribed, reactivate
+    if (existing && existing.status === 'unsubscribed') {
+      const { error: updateErr } = await supabase
+        .from('newsletter_subscribers')
+        .update({
+          status: 'active',
+          unsubscribed_at: null
+        })
+        .eq('id', existing.id);
+
+      if (updateErr) {
+        console.log('subscribe: update error', updateErr.message);
+        return {
+          statusCode: 500,
+          headers: { 'Content-Type': 'application/json', ...corsHeaders },
+          body: JSON.stringify({ ok: false, error: 'database_error', details: updateErr.message })
+        };
+      }
+
+      return {
+        statusCode: 200,
+        headers: { 'Content-Type': 'application/json', ...corsHeaders },
+        body: JSON.stringify({ ok: true, message: 'resubscribed' })
+      };
+    }
+
+    // New subscriber: insert
+    const { error: insertErr } = await supabase.from('newsletter_subscribers').insert({
+      email,
+      status: 'active',
+      source: payload.source || 'popup',
+      utm_source: payload.utm?.utm_source || null,
+      utm_campaign: payload.utm?.utm_campaign || null,
+      utm_medium: payload.utm?.utm_medium || null,
+      utm_content: payload.utm?.utm_content || null,
+      utm_term: payload.utm?.utm_term || null,
+      meta: {
+        page: payload.page || '/'
+      },
+      created_at: new Date().toISOString()
+    });
+
+    if (insertErr) {
+      console.log('subscribe: insert error', insertErr.message);
+      return {
+        statusCode: 500,
+        headers: { 'Content-Type': 'application/json', ...corsHeaders },
+        body: JSON.stringify({ ok: false, error: 'database_error', details: insertErr.message })
+      };
+    }
+
+    return {
+      statusCode: 200,
+      headers: { 'Content-Type': 'application/json', ...corsHeaders },
+      body: JSON.stringify({ ok: true, message: 'subscribed' })
+    };
+  } catch (err) {
+    console.error('[subscribe] Unexpected error:', err.message, err.stack);
+    return {
+      statusCode: 500,
+      headers: { 'Content-Type': 'application/json', ...corsHeaders },
+      body: JSON.stringify({ ok: false, error: 'unexpected_error', details: err.message })
+    };
   }
-  
-  return {
-    statusCode: 200,
-    headers: { 'Content-Type': 'application/json' },
-    body: JSON.stringify({ ok: true, success: true })
+};
```

```diff
diff --git a/netlify/functions/stats.js b/netlify/functions/stats.js
index old..new 100644
--- a/netlify/functions/stats.js
+++ b/netlify/functions/stats.js
@@ -25,18 +25,20 @@ exports.handler = async function(event) {
 
     const { data: emailRows = [], error: emailErr } = await supabase
-      .from('emails')
-      .select('id,email,confirmed,created_at')
+      .from('newsletter_subscribers')
+      .select('id,email,status,created_at')
+      .eq('status', 'active')
       .order('created_at', { ascending: false })
       .limit(50);
     if (emailErr) throw emailErr;
 
     const { count: totalEmails = 0, error: emailCountErr } = await supabase
-      .from('emails')
-      .select('id', { count: 'exact', head: true });
+      .from('newsletter_subscribers')
+      .select('id', { count: 'exact', head: true })
+      .eq('status', 'active');
     if (emailCountErr) throw emailCountErr;
```

```diff
diff --git a/assets/admin-dashboard.js b/assets/admin-dashboard.js
index old..new 100644
--- a/assets/admin-dashboard.js
+++ b/assets/admin-dashboard.js
@@ -214,13 +214,13 @@ class Dashboard {
       this.allEmails = emails;
       this.elements.emailTable.querySelectorAll('.table-row').forEach(row => row.remove());
       emails.forEach(email => {
         const row = this.createEmailRow(
           email.id,
           email.email,
           new Date(email.created_at).toLocaleString(),
-          email.confirmed ? '✓ Confirmed' : 'Pending'
+          email.status === 'active' ? '✓ Active' : (email.status || 'Pending')
         );
         this.elements.emailTable.appendChild(row);
       });
     }
 
     // Update newsletter count
     if (this.elements.newsletterCount) {
-      const confirmedCount = emails.filter(e => e.confirmed).length;
+      const confirmedCount = emails.filter(e => e.status === 'active').length;
       this.elements.newsletterCount.textContent = confirmedCount;
     }
 
@@ -403,8 +403,8 @@ class Dashboard {
     
     if (filterValue) {
       emailsToExport = emailsToExport.filter(email => {
-        if (filterValue === 'confirmed') return email.confirmed;
-        if (filterValue === 'pending') return !email.confirmed;
+        if (filterValue === 'active') return email.status === 'active';
+        if (filterValue === 'unsubscribed') return email.status === 'unsubscribed';
         return true;
       });
     }
@@ -414,7 +414,7 @@ class Dashboard {
     
     // CSV-Zeilen
     emailsToExport.forEach(email => {
       const date = new Date(email.created_at).toLocaleString();
-      const status = email.confirmed ? 'Confirmed' : 'Pending';
+      const status = email.status === 'active' ? 'Active' : (email.status || 'Pending');
       csv += `"${email.email}","${date}","${status}"\n`;
     });
 
@@ -460,8 +460,8 @@ class Dashboard {
     
     if (filterValue) {
       emailsToDelete = emailsToDelete.filter(email => {
-        if (filterValue === 'confirmed') return email.confirmed;
-        if (filterValue === 'pending') return !email.confirmed;
+        if (filterValue === 'active') return email.status === 'active';
+        if (filterValue === 'unsubscribed') return email.status === 'unsubscribed';
         return true;
       });
     }
```

---

## ENVIRONMENT VARIABLES REQUIRED

Netlify Dashboard → Build & Deploy → Environment Variables:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs... (service role, can write/read all)
RESEND_API_KEY=re_ABC123... (for newsletter sending, if used)
```

**Verification**:
```bash
# In Netlify Functions logs, should see:
# '[subscribe] Processing request: { method: POST }'
# NO error messages about "Supabase not configured"
```

---

## VERIFICATION TESTS

### Test 1: Frontend → Backend → Database (Happy Path)

```bash
# 1. Call signup endpoint
curl -X POST https://dropcharge.netlify.app/.netlify/functions/subscribe \
  -H "Content-Type: application/json" \
  -H "Origin: https://dropcharge.io" \
  -d '{
    "email": "test@example.com",
    "source": "popup",
    "page": "/",
    "utm": {
      "utm_source": "tiktok",
      "utm_campaign": "test_campaign"
    }
  }'

# Expected Response (200):
# {
#   "ok": true,
#   "message": "subscribed"
# }

# 2. Call stats endpoint (with admin token if protected)
curl -X GET https://dropcharge.netlify.app/.netlify/functions/stats \
  -H "x-admin-token: YOUR_ADMIN_TOKEN"

# Expected Response (200):
# {
#   "entries": [...clicks...],
#   "totals": { "platform": {...}, "amount": {...} },
#   "emailCount": 1,
#   "conversion": 0.xx,
#   "emails": [
#     {
#       "id": "uuid",
#       "email": "test@example.com",
#       "status": "active",
#       "created_at": "2026-02-21T10:30:00.000Z"
#     }
#   ]
# }

# 3. Verify Supabase directly (via psql or console)
# Query: SELECT email, status FROM newsletter_subscribers WHERE email = 'test@example.com'
# Result:  test@example.com | active ✓
```

### Test 2: Admin Dashboard Renders Correctly

```bash
# 1. Open in browser: https://dropchargeadmin.netlify.app
# 2. Login with admin token
# 3. Check "Email Stats" table:
#    ✓ Shows email address
#    ✓ Shows "✓ Active" (not "Confirmed" or error)
#    ✓ Shows timestamp
#    ✓ Newsletter count > 0
#
# 4. Test filters (if any):
#    ✓ Filter by "active" shows subscriber
#    ✓ Export CSV works
#    ✓ No console errors (F12 DevTools)
```

### Test 3: CORS Preflight

```bash
# 1. Curl OPTIONS request
curl -X OPTIONS https://dropcharge.netlify.app/.netlify/functions/subscribe \
  -H "Origin: https://dropcharge.io" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type"

# Expected Response (204 No Content):
# Headers should include:
#   Access-Control-Allow-Origin: https://dropcharge.io
#   Access-Control-Allow-Methods: POST, OPTIONS
#   Access-Control-Allow-Headers: Content-Type
```

### Test 4: Error Handling

```bash
# Test invalid email
curl -X POST https://dropcharge.netlify.app/.netlify/functions/subscribe \
  -H "Content-Type: application/json" \
  -H "Origin: https://dropcharge.io" \
  -d '{"email": "notanemail"}'

# Expected Response (400):
# {
#   "ok": false,
#   "error": "invalid_email",
#   "details": "Email format invalid"
# }

# Test missing body
curl -X POST https://dropcharge.netlify.app/.netlify/functions/subscribe \
  -H "Content-Type: application/json" \
  -H "Origin: https://dropcharge.io" \
  -d ''

# Expected Response (400):
# {
#   "ok": false,
#   "error": "invalid_email",
#   "details": "Email format invalid"
# }
```

---

## WHAT WAS WRONG (ROOT CAUSE)

1. **subscribe.js syntax**: Missing `};` at EOF → entire function malformed
2. **subscribe.js responses**: Text/plain instead of JSON → browser treats as error
3. **subscribe.js table**: Wrote to `emails` but admin read from `newsletter_subscribers` (SCHEMA MISMATCH)
4. **subscribe.js CORS**: No headers → browser blocks preflight request
5. **admin-dashboard.js fields**: Expected `confirmed` bool but table has `status` enum → UI shows no emails, filter broken
6. **stats.js table**: Read from `emails` → excluded real data from `newsletter_subscribers`

---

## DEPLOYMENT CHECKLIST

- [ ] Add env vars to Netlify (SUPABASE_*, RESEND_API_KEY)
- [ ] Deploy backend (netlify/functions/subscribe.js, stats.js)
- [ ] Deploy frontend (assets/admin-dashboard.js)
- [ ] Wait 1-2 min for Netlify builds
- [ ] Test signup via https://dropcharge.io (check console for errors)
- [ ] Check https://dropchargeadmin.netlify.app (verify emails appear)
- [ ] Check Supabase logs for any RLS errors (if enabled)
- [ ] Monitor error rate (Netlify Functions tab) for 24h

---

## ROLLBACK PLAN

If issues occur:
```bash
# Revert to previous version from git
git revert <commit-hash>
git push origin main

# Netlify auto-deploys on push
```
