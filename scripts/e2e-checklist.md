# DocHub P1 Features — Manual E2E Checklist

Run these against a locally started app (`npm run dev` with DB migrations applied).

## 1. Google OAuth

### 1.1 Provider is registered
```bash
curl -s http://localhost:3000/api/auth/providers | jq .
```
Expected: JSON contains a `google` provider with `id: "google"`, `name: "Google"`, and `signinUrl`.

### 1.2 Sign-up with Google (manual browser)
1. Open `http://localhost:3000/auth/signin`.
2. Click **Google**.
3. Complete OAuth consent.
4. Expected: Redirected to `/dashboard`; a new `Workspace` and `User` row are created with `role = ADMIN` and `password = null`.

### 1.3 Sign-in with existing Google user
1. Sign out.
2. Sign in with Google again using the same email.
3. Expected: Redirected to `/dashboard`; no duplicate user or workspace created.

---

## 2. Team Invitations

### 2.1 Create an invite
Sign in as an admin and grab the session cookie, then:
```bash
ADMIN_COOKIE="..."
curl -s -X POST http://localhost:3000/api/team/invite \
  -H "Content-Type: application/json" \
  -H "Cookie: $ADMIN_COOKIE" \
  -d '{"email":"invited@example.com","role":"EDITOR"}' | jq .
```
Expected: `201` with `invite.token` and `invite.inviteUrl`.

### 2.2 Verify the invite
```bash
TOKEN="...token from step 2.1..."
curl -s "http://localhost:3000/api/team/invite/verify?token=$TOKEN" | jq .
```
Expected: `200` with `invite.email`, `invite.role`, `invite.workspaceName`.

### 2.3 Accept the invite
```bash
curl -s -X POST http://localhost:3000/api/team/accept \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$TOKEN\",\"name\":\"Invited User\",\"password\":\"password123\"}" | jq .
```
Expected: `201` with new user details. `workspace_invites.accepted_at` should now be set.

### 2.4 New member can sign in
```bash
curl -s -X POST http://localhost:3000/api/auth/callback/credentials \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=invited@example.com&password=password123&callbackUrl=http%3A%2F%2Flocalhost%3A3000%2Fdashboard&csrfToken=..." \
  -c session.txt -L | grep -i dashboard
```
Expected: Session cookie is set and redirect to `/dashboard` occurs.

### 2.5 List team members
```bash
curl -s http://localhost:3000/api/team -H "Cookie: $ADMIN_COOKIE" | jq .
```
Expected: Array contains both admin and invited member.

### 2.6 Remove / change role
```bash
MEMBER_ID="..."
curl -s -X PATCH "http://localhost:3000/api/team/members/$MEMBER_ID" \
  -H "Content-Type: application/json" \
  -H "Cookie: $ADMIN_COOKIE" \
  -d '{"role":"ADMIN"}' | jq .

curl -s -X DELETE "http://localhost:3000/api/team/members/$MEMBER_ID" \
  -H "Cookie: $ADMIN_COOKIE" | jq .
```
Expected: `200` for PATCH; `200` for DELETE. Removing the last admin or yourself should return `400`.

---

## 3. Custom Domain

### 3.1 Set and verify a domain
```bash
curl -s -X POST http://localhost:3000/api/team/domain \
  -H "Content-Type: application/json" \
  -H "Cookie: $ADMIN_COOKIE" \
  -d '{"domain":"docs.example.com"}' | jq .
```
Without real DNS this returns `422` with `instructions`. Configure a real test domain or override DNS in dev to test the success path.

### 3.2 Read domain status
```bash
curl -s http://localhost:3000/api/team/domain -H "Cookie: $ADMIN_COOKIE" | jq .
```
Expected: `domain`, `verified` boolean, `verifiedAt`, and optional `instructions`.

### 3.3 Share link uses custom domain
After a domain is verified:
1. Open dashboard.
2. Create a share link.
3. Expected: Copied URL begins with `https://docs.example.com/v/{slug}` instead of `http://localhost:3000`.

### 3.4 Viewer page on custom domain
With a real domain pointed at the app:
```bash
curl -s -H "Host: docs.example.com" http://localhost:3000/v/{slug}
```
Expected: HTML viewer gate for the link. A slug belonging to a different workspace should return `404`.

### 3.5 Remove custom domain
```bash
curl -s -X DELETE http://localhost:3000/api/team/domain \
  -H "Cookie: $ADMIN_COOKIE" | jq .
```
Expected: `200` and `customDomain` / `customDomainVerifiedAt` are cleared.
