-- Twin Admin - Seed Data (License Tiers, RBAC)

-- License Tiers
INSERT INTO license_tiers (product, tier, name, max_doctors, max_patients, max_twins, storage_gb, gpu_hours_per_month, exports_per_month, ar_sessions_per_month, price_monthly_cents, price_yearly_cents) VALUES
('surgitwin', 'starter', 'Starter', 3, 50, 100, 50, 10, 200, 50, 29900, 299000),
('surgitwin', 'professional', 'Professional', 15, 500, 1000, 500, 100, 2000, 500, 99900, 999000),
('surgitwin', 'enterprise', 'Enterprise', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('glowmorph', 'starter', 'Creator', NULL, NULL, NULL, 10, 5, 100, NULL, 1999, 19990),
('glowmorph', 'professional', 'Pro', NULL, NULL, NULL, 100, 50, 1000, NULL, 4999, 49990),
('glowmorph', 'enterprise', 'Enterprise', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
ON CONFLICT (product, tier) DO NOTHING;

-- RBAC Permissions
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
('viewer', 'tenants', 'read'), ('viewer', 'billing', 'read'), ('viewer', 'users', 'read')
ON CONFLICT (role, resource, action) DO NOTHING;
