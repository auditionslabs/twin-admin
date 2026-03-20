# Twin Admin — Dashboard UI Structure

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **UI:** shadcn/ui + Tailwind CSS
- **Data:** TanStack Query (React Query)
- **Charts:** Recharts
- **Tables:** TanStack Table
- **Auth:** NextAuth.js (JWT + session)

---

## Route Structure

```
/                           → Redirect to /dashboard
/login                      → Admin login
/dashboard                  → Overview (platform or tenant-scoped)

# Platform-level (super_admin, platform_admin)
/tenants                    → Tenant list, create
/tenants/[id]               → Tenant detail
/tenants/[id]/billing       → Tenant billing
/tenants/[id]/usage         → Tenant usage
/tenants/[id]/doctors       → Doctor onboarding
/licenses                   → License key management
/licenses/generate          → Generate new key
/invoices                   → All invoices
/settings                   → Platform settings

# Tenant-level (tenant_admin, billing_admin, viewer)
/dashboard                  → Tenant overview
/usage                      → Usage & quotas
/billing                    → Subscription, invoices
/doctors                    → Doctor invites, onboarding
/exports                    → Export history
/ar-sessions                → AR session log
/settings                   → Tenant settings, white-label
```

---

## Page Components

### 1. Layout

```
AppLayout
├── Sidebar
│   ├── Logo (white-label aware)
│   ├── TenantSwitcher (platform admin only)
│   ├── NavItems (role-based)
│   └── UserMenu
├── Header
│   ├── Breadcrumb
│   ├── Search (tenants, doctors)
│   └── Notifications
└── Main
    └── {children}
```

### 2. Dashboard (Overview)

| Widget | Platform | Tenant |
|--------|----------|--------|
| Active tenants | ✓ | — |
| Total twins | ✓ | ✓ |
| Total doctors | ✓ | ✓ |
| Storage used | ✓ | ✓ |
| GPU hours (MTD) | ✓ | ✓ |
| Exports (MTD) | ✓ | ✓ |
| AR sessions (MTD) | ✓ | ✓ |
| Revenue (MTD) | ✓ | — |
| Alerts (quota, billing) | ✓ | ✓ |

### 3. Tenants List

- Table: name, slug, product, tier, status, twins, doctors, storage, actions
- Filters: product, tier, status
- Search: name, slug
- Actions: Edit, Billing, Usage, Suspend

### 4. Tenant Detail

- Tabs: Overview | Billing | Usage | Doctors | Settings
- **Overview:** Key metrics, recent activity
- **Billing:** Subscription, Stripe link, invoices
- **Usage:** Charts (twins, storage, GPU, exports, AR), quota bars
- **Doctors:** Invite list, onboarding progress
- **Settings:** White-label, tier, limits override

### 5. Usage & Quotas

- **Quota bars:** Twins, storage, GPU hours, exports, AR sessions
- **Charts:** Time series (daily/weekly/monthly)
- **Table:** Usage events (paginated, filterable)
- **Alerts:** Near-limit warnings

### 6. Billing

- **Subscription:** Current plan, Stripe customer portal link
- **Invoices:** List with PDF download
- **Line items:** Expandable per invoice

### 7. License Keys

- **List:** Key prefix, product, tier, type, status, activations, expires
- **Generate:** Form (product, tier, type, limits, expiry)
- **Actions:** Revoke, view activations

### 8. Doctor Onboarding

- **Invites:** Create invite, list pending/accepted
- **Steps:** Configure onboarding steps per tenant
- **Progress:** Table of doctors + completion status

### 9. White-Label Settings

- **Logo:** Upload
- **Colors:** Primary, secondary
- **Domain:** Custom domain
- **Support:** Email, hide branding toggle

---

## Component Hierarchy

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── login/page.tsx
│   ├── dashboard/
│   │   └── page.tsx
│   ├── tenants/
│   │   ├── page.tsx
│   │   └── [id]/
│   │       ├── page.tsx
│   │       ├── billing/page.tsx
│   │       ├── usage/page.tsx
│   │       ├── doctors/page.tsx
│   │       └── settings/page.tsx
│   ├── licenses/
│   │   ├── page.tsx
│   │   └── generate/page.tsx
│   ├── invoices/page.tsx
│   └── settings/page.tsx
├── components/
│   ├── layout/
│   │   ├── AppLayout.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── TenantSwitcher.tsx
│   ├── dashboard/
│   │   ├── MetricCard.tsx
│   │   ├── UsageChart.tsx
│   │   ├── QuotaBar.tsx
│   │   └── AlertBanner.tsx
│   ├── tenants/
│   │   ├── TenantTable.tsx
│   │   ├── TenantForm.tsx
│   │   └── WhiteLabelForm.tsx
│   ├── billing/
│   │   ├── SubscriptionCard.tsx
│   │   ├── InvoiceTable.tsx
│   │   └── StripePortalButton.tsx
│   ├── licenses/
│   │   ├── LicenseTable.tsx
│   │   ├── LicenseGenerateForm.tsx
│   │   └── ActivationList.tsx
│   └── doctors/
│       ├── InviteForm.tsx
│       ├── InviteTable.tsx
│       └── OnboardingProgressTable.tsx
├── lib/
│   ├── api.ts
│   ├── auth.ts
│   └── rbac.ts
└── hooks/
    ├── useTenant.ts
    ├── useUsage.ts
    └── useSubscription.ts
```

---

## RBAC in UI

- `lib/rbac.ts`: `canAccess(role, resource, action)`
- `usePermission(resource, action)` hook
- Components: `{canAccess('tenants', 'read') && <TenantTable />}`
- Route middleware: redirect to `/dashboard` if unauthorized

---

## Responsive

- Sidebar: Collapsible on mobile
- Tables: Horizontal scroll or card layout on small screens
- Charts: Responsive container
