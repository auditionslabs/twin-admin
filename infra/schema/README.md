# Twin Admin - Database Schema

Run migrations in order: `001_tenants` → `002_billing` → `003_usage` → `004_doctor_onboarding` → `005_invoices`.

## Schema Overview

| Migration | Domain | Tables |
|-----------|--------|-------|
| 001_tenants | Multi-tenant, RBAC | tenants, tenant_products, admin_users, admin_permissions |
| 002_billing | Subscriptions, licenses | license_tiers, subscriptions, license_keys, license_activations |
| 003_usage | Usage tracking | usage_snapshots, usage_events, tenant_quotas |
| 004_doctor_onboarding | Doctor invites | doctor_invites, doctor_onboarding_steps, doctor_onboarding_progress |
| 005_invoices | Invoicing, Stripe | invoices, invoice_line_items, stripe_events |

## License Tiers Seed

```sql
INSERT INTO license_tiers (product, tier, name, max_doctors, max_patients, max_twins, storage_gb, gpu_hours_per_month, exports_per_month, ar_sessions_per_month, price_monthly_cents) VALUES
('surgitwin', 'starter', 'Starter', 3, 50, 100, 50, 10, 200, 50, 29900),
('surgitwin', 'professional', 'Professional', 15, 500, 1000, 500, 100, 2000, 500, 99900),
('surgitwin', 'enterprise', 'Enterprise', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('glowmorph', 'starter', 'Creator', NULL, NULL, NULL, 10, 5, 100, NULL, 1999),
('glowmorph', 'professional', 'Pro', NULL, NULL, NULL, 100, 50, 1000, NULL, 4999),
('glowmorph', 'enterprise', 'Enterprise', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
```

## RBAC Permissions Seed

```sql
INSERT INTO admin_permissions (role, resource, action) VALUES
('super_admin', 'tenants', 'create'), ('super_admin', 'tenants', 'read'), ('super_admin', 'tenants', 'update'), ('super_admin', 'tenants', 'delete'),
('super_admin', 'billing', 'create'), ('super_admin', 'billing', 'read'), ('super_admin', 'billing', 'update'), ('super_admin', 'billing', 'delete'),
('super_admin', 'licenses', 'create'), ('super_admin', 'licenses', 'read'), ('super_admin', 'licenses', 'update'), ('super_admin', 'licenses', 'delete'),
('super_admin', 'users', 'create'), ('super_admin', 'users', 'read'), ('super_admin', 'users', 'update'), ('super_admin', 'users', 'delete'),
('platform_admin', 'tenants', 'read'), ('platform_admin', 'tenants', 'update'),
('platform_admin', 'billing', 'read'), ('platform_admin', 'licenses', 'create'), ('platform_admin', 'licenses', 'read'), ('platform_admin', 'licenses', 'update'),
('platform_admin', 'users', 'read'), ('platform_admin', 'users', 'update'),
('tenant_admin', 'billing', 'read'), ('tenant_admin', 'users', 'create'), ('tenant_admin', 'users', 'read'), ('tenant_admin', 'users', 'update'),
('billing_admin', 'billing', 'read'), ('billing_admin', 'billing', 'update'),
('viewer', 'tenants', 'read'), ('viewer', 'billing', 'read'), ('viewer', 'users', 'read');
```
