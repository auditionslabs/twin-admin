# Twin Admin — Multi-Tenant Isolation Architecture

## Overview

Twin Admin is a unified control platform for **SurgiTwin Pro** (medical) and **GlowMorph Studio** (entertainment). Tenants are isolated by `tenant_id`; platform admins can cross-tenant; tenant admins are scoped.

## Tenant Model

| Concept | SurgiTwin Pro | GlowMorph Studio |
|---------|---------------|------------------|
| Tenant | Organization (clinic, hospital) | Workspace (enterprise) or single user |
| External ID | `organizations.id` | `tenant_id` (nullable for free users) |
| Billing | Per-org subscription | Per-workspace or per-user |

## Isolation Layers

### 1. Database

- All tenant-scoped tables have `tenant_id` column
- Row-level security (RLS) optional; application enforces via `WHERE tenant_id = :current_tenant`
- Indexes: `(tenant_id, ...)` for all tenant tables

### 2. API

- Every request resolves `tenant_id` from:
  - JWT claim `tenant_id` (tenant admin)
  - JWT claim `platform_admin: true` (can impersonate)
  - Path param: `/tenants/:tenantId/...`
- Middleware: `requireTenantAccess(tenantId)`

### 3. Storage (S3/MinIO)

- Bucket structure: `{bucket}/tenants/{tenant_id}/...`
- Pre-signed URLs scoped to tenant path
- No cross-tenant object access

### 4. Redis / Queue

- Queue keys: `twin:jobs:{tenant_id}:{job_id}`
- Cache keys: `twin:cache:{tenant_id}:{key}`
- Rate limits: `twin:ratelimit:{tenant_id}:{window}`

## RBAC Matrix

| Role | Tenants | Billing | Licenses | Users | Usage |
|------|---------|--------|----------|-------|-------|
| super_admin | All | All | All | All | All |
| platform_admin | All | Read | Create/Revoke | All | All |
| tenant_admin | Own | Own | — | Own | Own |
| billing_admin | Own | Own | — | — | Own |
| viewer | Own | Read | — | Read | Read |

## White-Label

Stored in `tenants.white_label_config`:

```json
{
  "logo_url": "https://...",
  "primary_color": "#0066cc",
  "support_email": "support@clinic.com",
  "custom_domain": "twin.clinic.com",
  "hide_twin_branding": true
}
```

- API returns config to client; client applies theme
- Custom domain: CNAME to Twin Admin; TLS via Let's Encrypt or Cloudflare

## Data Flow

```
SurgiTwin Pro / GlowMorph Studio
         │
         │  (webhook, API, sync)
         ▼
   Twin Admin API
         │
         ├──► Postgres (tenants, billing, usage)
         ├──► Redis (cache, queue)
         ├──► Stripe (subscriptions)
         └──► License validation endpoint
```

## Sync from Product DBs

- **Option A:** Products push usage events to Twin Admin API (`POST /usage/events`)
- **Option B:** Twin Admin polls product DBs (read replica) — requires shared DB or API
- **Option C:** Event bus (Kafka, SQS) — products publish; Admin consumes

Recommended: **Option A** — products emit usage events on twin create, export, AR session, etc.
