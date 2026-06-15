---
workflow_contract_version: 1
feature_slug: dochub
target_surface: web
product_depth: deep
recommended_next_step: to-issues
p0_stories: [US-001, US-002, US-003, US-004]
issue_mapping_count: 6
hard_constraints_count: 4
known_unknowns_count: 3
acceptance_scripts_count: 4
generated_at: 2026-06-13
---

# PRD: DocHub - DocSend-like Document Sharing & Analytics SaaS

## 0. Flow Readiness Card

- Product: DocHub lets teams upload PDFs, create tracked share links, and see who viewed their documents and for how long.
- Core user loop: Upload PDF → create link with access rules → share link → viewer opens → analytics update in real-time.
- Target surface: web
- P0 outcome: A user can upload one PDF, generate a password-protected link with expiration, and see open/page/time analytics in a dashboard.
- Hard constraints: Documents must be stored encrypted at rest; share links must not leak document URL without access control; analytics events must be attributed to a unique viewer session without PII unless the viewer consents.
- Recommended defaults: PostgreSQL for relational data, UploadThing for PDF storage, NextAuth.js for authentication, Prisma as ORM, Tailwind + shadcn/ui for UI.
- Creative space: Dashboard visualizations, empty states, link preview cards, color theme.
- Must not build: Native mobile apps, real-time collaboration editing, payment/subscription in P0, AI summarization.
- Sharpest product decision: Use single-use viewer sessions (fingerprint + localStorage) for analytics instead of requiring viewer login, lowering friction while preserving attribution.
- P0 acceptance script: Upload a PDF, create a password-protected expiring link, open it in an incognito window, verify analytics show one view with duration.
- Best next step: /to-issues because the product has clear backend/frontend/data vertical slices.

## 1. Product Decision Core

### 1.1 Positioning
DocHub lets sales, marketing, and investor-relations teams share sensitive PDFs with controlled access and detailed engagement analytics, without building a custom document portal.

### 1.2 Differentiation and Switching Trigger
| Current alternative | Why it fails | Product difference | Switching trigger | Fact status |
|---|---|---|---|---|
| Email attachments | No visibility after send; files forwarded uncontrollably | Tracked links with password/expiration/email gating | User sends a pitch deck and never knows if it was opened | Verified |
| Google Drive shared links | Generic analytics; hard to gate per-viewer | Per-link access rules + viewer-level analytics | User needs to know which prospect spent time on which page | Verified |
| Generic file hosting (WeTransfer) | No analytics; links expire but no tracking | Page-level time + completion analytics | User wants to follow up based on engagement, not guesswork | Verified |

### 1.3 User Segments
| Segment | Core goal | Current frustration | Switch-worthy moment | P0 relevance |
|---|---|---|---|---|
| Sales rep | Know which prospects engaged | Blind after sending deck | Seeing per-prospect time and page flow | High |
| Marketing manager | Distribute gated collateral | Cannot measure content performance | Campaign-level analytics and email gates | High |
| Startup founder | Share pitch deck securely | Forwarded decks reach wrong people | Password + expiration + domain restriction | Medium |
| Team admin | Manage workspace documents | Files scattered across tools | Team workspace with role-based access | Medium |

### 1.4 User Problem
- Current pain: Senders lose control and visibility once a document leaves their inbox.
- Why now: Remote sales and async investor pitches require data-driven follow-up.
- Existing workaround: Email read receipts, Google Drive view counts, or asking recipients.
- Why the workaround fails: Read receipts are unreliable; Drive counts are aggregate; asking is intrusive and manual.

### 1.5 Success Definition
- User-visible success: Sender sees within 30 seconds that a recipient opened the document.
- Business/project success: A team creates and shares at least one tracked link in the first session.
- Engineering success: Analytics events are accurate within 1 second and storage is encrypted.

### 1.6 Assumptions and Fact Status
| Item | Status | Why it matters |
|---|---|---|
| PDF is the dominant P0 document format | Assumption | Drives upload and viewer strategy |
| Viewers accept fingerprint-based tracking if disclosed | Assumption | Drives analytics attribution model |
| Custom domains are configured via CNAME | Verified | Drives multi-tenant routing architecture |

## 2. Scope Contract

### 2.1 Hard Constraints
| ID | Constraint | Why it is hard | Downstream impact |
|---|---|---|---|
| HC-1 | PDFs encrypted at rest | Security baseline | Storage provider or bucket encryption required |
| HC-2 | Share links enforce password/expiration/email gate before serving | Prevents unauthorized access | Access-control layer must run before file download |
| HC-3 | Viewer sessions must be unique per browser/incognito combination | Accurate analytics | Fingerprint + localStorage fallback, not only cookie |
| HC-4 | No PII stored from viewers unless they enter email | Privacy compliance | Analytics schema stores session hash, not email, unless gated |

### 2.2 Recommended Defaults
| Default | Why this default | Acceptable substitute |
|---|---|---|
| UploadThing for PDF storage | Simpler than S3 setup | AWS S3 with presigned URLs if scale demands |
| NextAuth.js with email/password + Google OAuth | Standard Next.js auth | Clerk or Auth0 if enterprise SSO needed |
| Prisma + PostgreSQL | Type-safe ORM with good Next.js support | Drizzle if team prefers |
| Recharts for analytics charts | Lightweight, React-friendly | Tremor or Chart.js |

### 2.3 Creative Space
| Area | What may improve | Guardrail |
|---|---|---|
| Dashboard charts | Chart type, color, granularity | Must not expose other users' documents |
| Link preview page | Branding, copy, loading state | Must enforce access rules before showing content |
| Empty states | Illustrations, CTA copy | Must guide user to upload first |

### 2.4 Non-Goals
| Non-goal | Why excluded | Revisit trigger |
|---|---|---|
| Real-time collaborative editing | Too complex for P0; focus on sharing/tracking | Users demand commenting/annotation |
| Subscription billing | Blocks launch; add after retention proven | Paid feature requests exceed 20% |
| Mobile native apps | Web-first MVP | >30% mobile views or enterprise demand |
| AI document summary | Not core value proposition | User research shows high demand |

## 3. Users, Jobs, and Scenarios

### 3.1 Primary User
- Role: Sales rep or marketing manager
- Job-to-be-done: Share a document and understand engagement
- Current trigger: Needs to send a deck, proposal, or report
- Success evidence: Analytics dashboard shows views, time, and page flow

### 3.2 Secondary Users or Operators
- Team admin: manages workspace members and custom domain
- Viewer: external recipient who opens a shared link

### 3.3 Critical Scenarios
| Scenario | Entry point | Desired outcome | Failure to avoid |
|---|---|---|---|
| Upload and share | /dashboard | Tracked link created and copied | Upload fails silently |
| Viewer opens gated link | /v/{slug} | Access control enforced, document rendered | Document leaks without password |
| Admin reviews analytics | /dashboard/analytics/{id} | Real-time engagement metrics | Showing wrong document's data |
| Team member joins workspace | /settings/team | Member can access workspace documents | Unauthorized access to other teams |

## 4. User Stories

### US-001: Upload a PDF to the workspace
**Description:** As a logged-in user, I want to upload a PDF so that I can create tracked share links.
**Priority:** P0
**Source:** Critical scenario

**Acceptance Criteria:**
- [ ] User can select a PDF up to 20MB.
- [ ] Upload progress is shown.
- [ ] Document appears in dashboard with filename and upload time.
- [ ] UI verified in browser before shipping.

### US-002: Create a tracked share link with access rules
**Description:** As a document owner, I want to create a share link with password, expiration, and optional email gate so that I control who can view it.
**Priority:** P0
**Source:** Critical scenario

**Acceptance Criteria:**
- [ ] User can set password, expiration date, and email-gate toggle.
- [ ] Link slug is unique and unguessable.
- [ ] Link settings are persisted and editable.
- [ ] UI verified in browser.

### US-003: View a shared PDF through access control
**Description:** As a viewer, I want to open a shared link, enter required credentials, and view the PDF so that I can read the shared content.
**Priority:** P0
**Source:** Critical scenario

**Acceptance Criteria:**
- [ ] Password-protected links require correct password.
- [ ] Expired links show an expiration message.
- [ ] Email-gated links require a valid email.
- [ ] PDF renders in browser without direct file URL exposure.

### US-004: See document analytics in dashboard
**Description:** As a document owner, I want to see views, unique viewers, total time, and per-page time so that I can prioritize follow-up.
**Priority:** P0
**Source:** Critical scenario

**Acceptance Criteria:**
- [ ] Dashboard shows total views, unique viewers, and average view duration.
- [ ] Per-document analytics page shows a views-over-time chart.
- [ ] Page-level heatmap or table shows time per page.
- [ ] Data updates within 5 seconds of a new view.

### US-005: Configure custom domain for workspace
**Description:** As a team admin, I want to serve shared links under my own domain so that the experience matches my brand.
**Priority:** P1
**Source:** User segment

**Acceptance Criteria:**
- [ ] Admin can add a custom domain and see required DNS records.
- [ ] System validates CNAME or A record before activating.
- [ ] Shared links use custom domain once verified.

### US-006: Manage team workspace members
**Description:** As a team admin, I want to invite members and assign roles so that my team can collaborate.
**Priority:** P1
**Source:** User segment

**Acceptance Criteria:**
- [ ] Admin can invite by email.
- [ ] Members can be viewer or editor roles.
- [ ] Workspace documents are isolated from other workspaces.

## 5. Functional Requirements

- FR-1: The system must accept PDF uploads up to 20MB per file.
- FR-2: The system must generate a unique, unguessable share link slug per document.
- FR-3: The system must enforce password protection before serving a document.
- FR-4: The system must reject expired share links.
- FR-5: The system must collect and store viewer analytics events (open, page view, duration).
- FR-6: The system must attribute analytics to a unique viewer session without requiring login.
- FR-7: The system must isolate documents and analytics by workspace.
- FR-8: The system must support custom domain routing for verified domains.
- FR-9: The system must encrypt stored PDFs at rest.
- FR-10: The system must provide a real-time analytics dashboard.

## 6. Experience and State Contract

### 6.1 Primary Flow
```text
User logs in
    |
    v
Uploads PDF
    |
    v
Creates share link with rules
    |
    v
Copies link
    |
    v
Viewer opens link → access control → renders PDF
    |
    v
Analytics events recorded
    |
    v
Dashboard updates
```

### 6.2 Layout or Interface Model
```text
+--------------------------------------------------+
| Sidebar |  Main content area                     |
|         |  +----------------------------------+  |
| Upload  |  | Stats cards (views, time, etc.)  |  |
| Docs    |  +----------------------------------+  |
| Links   |  | Documents table                  |  |
| Analytics| +----------------------------------+  |
| Team    |                                        |
+--------------------------------------------------+
```

### 6.3 States
| State | Trigger | Visual marker | User/system sees | Exit condition |
|---|---|---|---|---|
| Empty workspace | First login | Empty-state illustration | Upload CTA | User uploads |
| Uploading | File selected | Progress bar | Percentage and filename | Upload complete |
| Link active | Link created | Copy button + green status | Link URL and settings | Link edited or expired |
| Viewer gate | Link needs password | Password input modal | Locked preview | Correct password |
| Analytics loading | Open analytics page | Skeleton charts | Placeholder bars | Data loaded |

### 6.4 Failure Paths
| Failure | Cause | User/system response | Recovery |
|---|---|---|---|
| Upload too large | >20MB | Inline error with size limit | Select smaller file |
| Wrong password | Viewer input | Red error, retry | Re-enter password |
| Expired link | Past expiration | Expiration message | Owner renews link |
| Custom domain not verified | DNS missing | Warning banner with records | Admin updates DNS |

### 6.5 Module Experience Contracts

#### Module: Document Upload
##### Part a) Shape and Flow
- Surface: UI
- ASCII:
```text
+----------------------------------+
| Drop PDF here or click to browse |
| Max 20MB                         |
+----------------------------------+
```
- Normal flow: click/drop → validate → upload → show in list
- Failure: size error → show limit; type error → reject

##### Part b) States
| State | Trigger | Visual marker | User/system sees | Exit condition |
|---|---|---|---|---|
| Default | Page load | Dashed border | Drop zone | File hover |
| Drag over | File dragged | Solid border + highlight | Drop instruction | File dropped |
| Uploading | File accepted | Progress bar | Percentage | Upload complete |
| Success | Upload done | Checkmark | Document row added | N/A |

##### Part c) Data Dependencies
- Reads: workspace ID from session
- Writes: document record + file URL to database and storage
- Data flow: Browser file → UploadThing → returns URL → API saves metadata

##### Part d) Product Decisions
| Decision | Safe default | What would change this |
|---|---|---|
| Max file size 20MB | Balances feature coverage and cost | Enterprise plan allows larger |
| Drag-and-drop upload | Modern standard | Mobile requires click-to-browse |

##### Part e) Boundary Cases
- Zero-byte file: reject with error
- Non-PDF MIME type: reject before upload
- Network interruption during upload: retry button

#### Module: Share Link Viewer
##### Part a) Shape and Flow
- Surface: UI
- ASCII:
```text
+------------------+
| Logo             |
| Enter password   |
| [______________] |
| [View Document]  |
+------------------+
```
- Normal flow: open link → gate check → enter credentials → render PDF
- Failure: wrong password → error; expired → expiration page

##### Part b) States
| State | Trigger | Visual marker | User/system sees | Exit condition |
|---|---|---|---|---|
| Loading | Link opened | Spinner | Loading message | Metadata fetched |
| Password gate | Password required | Password input | Masked field | Correct password |
| Expired | Link expired | Warning icon | Expiration message | Owner renews |
| Viewing | Access granted | PDF viewer | Rendered pages | User leaves |

##### Part c) Data Dependencies
- Reads: link settings, document URL
- Writes: analytics events
- Data flow: Link slug → lookup access rules → serve viewer → record events

##### Part d) Product Decisions
| Decision | Safe default | What would change this |
|---|---|---|
| Show thumbnail before gate | No, protect content | Marketing use case requires preview |
| Store viewer email if gated | Yes, with consent | Privacy regulation requires anonymization |

##### Part e) Boundary Cases
- Direct file URL access: must 404 or redirect to gate
- Incognito viewer: fingerprint still attributes session
- Disabled JavaScript: viewer cannot render; show fallback message

## 7. Data and Integration Contract

### 7.1 Core Data Objects
```jsonc
{
  "version": "1",
  "workspace": {
    "id": "uuid",              // required: workspace identifier
    "name": "string",          // required: display name
    "slug": "string",          // required: unique subdomain slug
    "customDomain": "string | null", // verified custom hostname
    "plan": "free"             // required: billing tier
  },
  "user": {
    "id": "uuid",              // required: user identifier
    "email": "string",         // required: login email
    "role": "admin | editor",  // required: workspace role
    "workspaceId": "uuid"      // required: belongs to workspace
  },
  "document": {
    "id": "uuid",              // required: document identifier
    "workspaceId": "uuid",     // required: isolation key
    "filename": "string",      // required: original filename
    "storageKey": "string",    // required: encrypted storage reference
    "fileSize": "number",      // required: bytes
    "uploadedAt": "timestamp", // required: ISO-8601
    "uploadedBy": "uuid"       // required: user id
  },
  "shareLink": {
    "id": "uuid",              // required: link identifier
    "documentId": "uuid",      // required: linked document
    "slug": "string",          // required: unique unguessable slug
    "passwordHash": "string | null", // bcrypt hash if password protected
    "expiresAt": "timestamp | null", // expiration datetime
    "emailGate": "boolean",    // required: whether to require viewer email
    "allowDownload": "boolean" // required: whether viewer can download PDF
  },
  "viewSession": {
    "id": "uuid",              // required: session identifier
    "linkId": "uuid",          // required: link viewed
    "fingerprint": "string",   // required: browser fingerprint hash
    "viewerEmail": "string | null", // collected if email gate on
    "startedAt": "timestamp",  // required: session start
    "durationSeconds": "number" // total engaged time
  },
  "pageView": {
    "sessionId": "uuid",       // required: parent session
    "pageNumber": "number",    // required: PDF page index
    "enteredAt": "timestamp",  // required: when page became visible
    "durationSeconds": "number" // time spent on page
  }
}
```

### 7.2 External Interfaces
| Interface | Direction | Contract | Failure mode |
|---|---|---|---|
| UploadThing/S3 | write/read | File upload → URL; signed GET for viewer | Upload failure, bucket unreachable |
| NextAuth provider | read | OAuth/email verification | Login failure |
| PostgreSQL | read/write | Prisma queries | Connection error |
| Browser PDF viewer | read | Render via signed URL or inline | Browser incompatibility |

### 7.3 Data Retention, Privacy, and Permissions
- PDFs encrypted at rest via storage provider.
- Viewer fingerprints are hashed; raw IPs are not stored.
- Workspace isolation enforced at database query level.
- Only workspace members can list documents; only link holders can view if rules pass.

### 7.4 Architecture, Package Sizes, and Replaceability
```text
+--------------------------------------------------+
| Next.js App Router (pages, API routes, server)   |
+--------------------------------------------------+
| Prisma ORM                                       |
+--------------------------------------------------+
| PostgreSQL + UploadThing/S3                      |
+--------------------------------------------------+
```

Dependency table:
| Dependency / library | Purpose | Why better than alternative | Package size |
|---|---|---|---|
| Next.js 14 | Full-stack React framework | API + UI in one repo, App Router | Large |
| Prisma | Type-safe ORM | Best TypeScript DX and migrations | Medium |
| PostgreSQL | Relational data | ACID + JSON support for analytics | N/A (service) |
| UploadThing | PDF storage | Simpler than AWS S3 setup | Small |
| NextAuth.js | Authentication | Native Next.js integration | Medium |
| Tailwind + shadcn/ui | Styling | Rapid UI without custom CSS | Medium |
| Recharts | Analytics charts | Lightweight React charts | Small |

Biggest architecture risk: Custom domain routing on Vercel/edge requires host header parsing and tenant lookup on every viewer request. If misconfigured, links may serve wrong workspace content.

Replaceability:
| Decision | Recommended default | Acceptable substitute | Invariant that must not change |
|---|---|---|---|
| Auth | NextAuth.js | Clerk/Auth0 | Workspace-scoped session identity |
| Storage | UploadThing | AWS S3 with presigned URLs | Files encrypted at rest |
| ORM | Prisma | Drizzle | Workspace-isolated queries |
| Charts | Recharts | Tremor | No cross-workspace data leakage |

### 7.5 Output and Delivery Contract
| Output form | Description | Who consumes it |
|---|---|---|
| Share link URL | Public or custom-domain link to view a document | Sender shares with recipient |
| Analytics dashboard | Web UI with views, time, page flow | Document owner/team |
| CSV export | Per-link view log export | Team admin |
| Viewer page | Rendered PDF with access gate | External recipient |

## 8. Risks, Unknowns, and Open Decisions

### 8.1 Risks
| Risk | Impact | Mitigation | Owner |
|---|---|---|---|
| Custom domain DNS misconfiguration | High | Validate DNS before activation; fallback to default domain | Backend |
| PDF viewer fingerprint blocked by privacy tools | Medium | Degrade to session cookie; record as anonymous | Frontend |
| Storage cost explosion | Medium | 20MB limit, retention policy, monitoring | Platform |
| Analytics event spoofing | Medium | Validate events server-side; rate limit | Backend |

### 8.2 Known Unknowns
| Unknown | Why it matters | Safe default |
|---|---|---|
| Actual page-level time accuracy from PDF.js | Affects analytics trust | Use IntersectionObserver + heartbeat |
| Custom domain TLS termination provider | Affects deployment architecture | Use Vercel managed domains or Caddy |
| Viewer consent requirements per region | Affects privacy copy | Show tracking disclosure banner |

### 8.3 Open Decisions
| Decision | Options | Default recommendation | Change signal |
|---|---|---|---|
| PDF rendering engine | PDF.js native vs react-pdf | PDF.js for full control | Mobile performance issues |
| Analytics aggregation | Real-time vs batch | Real-time for P0 | Cost or latency problems |
| Team roles | Admin/editor/viewer | Admin/editor for P0 | Enterprise needs viewer-only |

### 8.4 Product Metrics and Performance Targets
| Target | Goal value | Measurement method | Degradation threshold |
|---|---:|---|---:|
| Upload completion time | <= 5s for 10MB | Browser network timing | > 15s |
| Link page first contentful paint | <= 1.5s | Lighthouse | > 3s |
| Analytics event ingestion latency | <= 2s | Server log timestamps | > 10s |
| Password gate response | <= 300ms | API response timing | > 1s |
| Custom domain activation | <= 5 min after DNS | Automated DNS check | > 30 min |

## 9. Verification Matrix

| ID | Requirement | Evidence | Check method | Required before ship? |
|---|---|---|---|---|
| US-001 | PDF upload up to 20MB | Screenshot of uploaded document in dashboard | Manual browser test | Yes |
| US-002 | Password/expiration link creation | Link settings modal screenshot + DB row | Manual test + DB query | Yes |
| US-003 | Expired link blocks access | Browser shows expiration page | Manual test | Yes |
| US-004 | Analytics show view duration | Dashboard screenshot after opening link | Manual test | Yes |
| FR-9 | Storage encryption | UploadThing/S3 config audit | Console check | Yes |
| US-005 | Custom domain serves links | curl custom domain returns viewer page | DNS + HTTP test | P1 |
| US-006 | Team member sees workspace docs | Member login shows shared documents | Manual test | P1 |

## 10. Suggested Issue Mapping

### Issue 1: Project scaffold and database schema
- Source: FR-1, FR-7, FR-9, HC-1
- Type: infra
- Priority: high
- Dependencies: None
- Why this slice: All other features depend on the project structure and data model.
- Acceptance Criteria:
  - [ ] Next.js 14 App Router project initialized with TypeScript, Tailwind, shadcn/ui.
  - [ ] Prisma schema defines Workspace, User, Document, ShareLink, ViewSession, PageView.
  - [ ] PostgreSQL connection works in local dev via Docker Compose.
  - [ ] UploadThing bucket configured.
- Validation:
  - [ ] `npm run dev` starts without errors.
  - [ ] `npx prisma migrate dev` applies cleanly.
- Loop-it notes:
  - Branch hint: feat/scaffold
  - Risk class: build_failure

### Issue 2: Authentication and workspace isolation
- Source: US-006, FR-7, HC-3, HC-4
- Type: backend
- Priority: high
- Dependencies: Issue 1
- Why this slice: User identity and workspace isolation are prerequisites for secure document operations.
- Acceptance Criteria:
  - [ ] NextAuth.js configured with email/password and Google OAuth.
  - [ ] On first login, a default workspace is created.
  - [ ] All document queries filter by workspaceId.
  - [ ] Role-based access: admin can invite; editor can upload.
- Validation:
  - [ ] Test: user A cannot see user B's documents.
  - [ ] Manual: invite flow creates a member row.
- Loop-it notes:
  - Branch hint: feat/auth-workspace
  - Risk class: test_failure

### Issue 3: PDF upload and document dashboard
- Source: US-001, FR-1
- Type: fullstack
- Priority: high
- Dependencies: Issue 1, Issue 2
- Why this slice: Core value loop starts with uploading and seeing documents.
- Acceptance Criteria:
  - [ ] Drag-and-drop upload UI.
  - [ ] File size validation (<=20MB).
  - [ ] Document list in dashboard with filename, size, date.
  - [ ] Upload progress and error states.
- Validation:
  - [ ] Screenshot of dashboard with uploaded document.
  - [ ] Upload a 25MB file and verify error.
- Loop-it notes:
  - Branch hint: feat/upload-dashboard
  - Risk class: test_failure

### Issue 4: Share link creation with access rules
- Source: US-002, FR-2, FR-3, FR-4, HC-2
- Type: fullstack
- Priority: high
- Dependencies: Issue 3
- Why this slice: Without controlled links, the product is just file storage.
- Acceptance Criteria:
  - [ ] Create link modal with password, expiration, email gate, allow download.
  - [ ] Slug generated with nanoid/base64url.
  - [ ] Password stored as bcrypt hash.
  - [ ] Link copied to clipboard with toast.
- Validation:
  - [ ] DB query confirms shareLink row with rules.
  - [ ] Manual: create password-protected link and copy URL.
- Loop-it notes:
  - Branch hint: feat/share-link
  - Risk class: test_failure

### Issue 5: Viewer page and access control
- Source: US-003, FR-3, FR-4, FR-6, HC-2, HC-3
- Type: fullstack
- Priority: high
- Dependencies: Issue 4
- Why this slice: This is the recipient-facing surface; access rules must be enforced here.
- Acceptance Criteria:
  - [ ] Viewer route `/v/{slug}` resolves link and enforces rules.
  - [ ] Password gate form validates before serving PDF.
  - [ ] Expired links show expiration page.
  - [ ] PDF rendered via signed URL without exposing direct storage URL.
- Validation:
  - [ ] Manual: open protected link in incognito, verify gate.
  - [ ] Manual: open expired link, verify block.
- Loop-it notes:
  - Branch hint: feat/viewer
  - Risk class: test_failure

### Issue 6: Analytics collection and dashboard
- Source: US-004, FR-5, FR-6, FR-10, HC-3, HC-4
- Type: fullstack
- Priority: high
- Dependencies: Issue 5
- Why this slice: Analytics is the primary differentiator over file sharing.
- Acceptance Criteria:
  - [ ] Heartbeat/visibility events sent from viewer.
  - [ ] Server aggregates views, unique viewers, total time, page time.
  - [ ] Dashboard shows stats cards and views-over-time chart.
  - [ ] Page-level time table or heatmap.
- Validation:
  - [ ] Manual: open link, dashboard updates within 5 seconds.
  - [ ] Screenshot of analytics page.
- Loop-it notes:
  - Branch hint: feat/analytics
  - Risk class: test_failure

## 11. Downstream Handoff

### 11.1 For /prd-to-spec
- Run /prd-to-spec if custom domain edge routing or analytics aggregation architecture needs deeper review.
- Architecture decisions to preserve: UploadThing for storage, Prisma/PostgreSQL, NextAuth.js, workspace isolation at query level.
- Technical questions that need resolution: custom domain TLS termination (Vercel vs Caddy vs self-hosted).

### 11.2 For /to-issues
- Use Section 10 as primary source.
- Preserve Source, Dependencies, Acceptance Criteria, Validation, and Loop-it notes.
- Do not create issues from Creative Space unless user confirms.

### 11.3 For /loop-it or /goal
- Build order: Issue 1 → Issue 2 → Issue 3 → Issue 4 → Issue 5 → Issue 6.
- Do not reinterpret these hard constraints: encrypted storage, access control before serving, workspace isolation, no PII without consent.
- Safe implementation freedoms: UI styling, chart library choice (within recommended defaults), exact copy.
- Stop and ask if: changing auth provider or storage provider.

### 11.4 For /review-it
- Review must verify: workspace isolation in DB queries, password gate enforcement, signed URLs for PDFs, no direct storage URL exposure, analytics event rate limiting.
- Findings that should be rejected as scope creep: adding billing, comments, or real-time collaboration in P0.

### 11.5 For /note-it and /ship-it
- Notes should capture: custom domain decisions, analytics event schema changes, auth provider quirks.
- PR body must include: closes issue reference, security decisions, and manual test evidence.

### 11.6 Acceptance Scripts
Acceptance Script 1: In a browser, sign up, upload a 5MB PDF, create a password-protected link expiring in 1 hour, copy the link, and capture a screenshot of the dashboard showing the document and link.
Acceptance Script 2: In an incognito window, open the protected link, enter a wrong password once, verify the error, enter the correct password, and verify the PDF renders. Capture the viewer page URL and a screenshot.
Acceptance Script 3: Return to the original browser session, open the analytics page for the document within 10 seconds, and verify at least one view, one unique viewer, and non-zero duration. Capture the analytics screenshot.
Acceptance Script 4: In the workspace settings, add a custom domain (using a test subdomain you control), add the required DNS record, wait for verification, create a new share link, and verify the link URL uses the custom domain.

## 12. Overdelivery Opportunities

| Opportunity | Effort | Why it matters | Guard |
|---|---|---|---|
| Link preview thumbnail | Low | Increases click-through on shared links | Do not expose first page without access rules |
| Email notifications on view | Low | Enables timely follow-up | Only if sender opts in; respect viewer privacy |
| Branded viewer page (logo, colors) | Medium | Reinforces sender brand | Keep customization scoped to CSS variables |
| Bulk upload | Low | Power users have many decks | Do not increase P0 storage cost assumptions |
