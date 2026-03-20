-- Twin Admin - Multi-Tenant Schema
-- Supports SurgiTwin Pro (org-based) and GlowMorph Studio (tenant-based)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE tenant_product AS ENUM ('surgitwin', 'glowmorph', 'both');
CREATE TYPE tenant_tier AS ENUM ('starter', 'professional', 'enterprise', 'custom');
CREATE TYPE admin_role AS ENUM ('super_admin', 'platform_admin', 'tenant_admin', 'billing_admin', 'viewer');
CREATE TYPE license_type AS ENUM ('cloud_subscription', 'local_perpetual', 'local_subscription', 'trial');

-- =============================================================================
-- TENANTS (Unified: SurgiTwin orgs + GlowMorph workspaces)
-- =============================================================================

CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id VARCHAR(100) UNIQUE,          -- SurgiTwin org_id or GlowMorph tenant_id
    product tenant_product NOT NULL DEFAULT 'surgitwin',
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    tier tenant_tier NOT NULL DEFAULT 'starter',
    white_label_config JSONB DEFAULT '{}',    -- logo, colors, domain, support_email
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tenant_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product tenant_product NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, product)
);

-- =============================================================================
-- ADMIN USERS & RBAC
-- =============================================================================

CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    name VARCHAR(100),
    role admin_role NOT NULL DEFAULT 'viewer',
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,  -- NULL = platform-level
    mfa_enabled BOOLEAN DEFAULT FALSE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE admin_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role admin_role NOT NULL,
    resource VARCHAR(50) NOT NULL,           -- 'tenants', 'billing', 'users', 'licenses'
    action VARCHAR(50) NOT NULL,              -- 'create', 'read', 'update', 'delete'
    UNIQUE(role, resource, action)
);

CREATE INDEX idx_admin_users_tenant ON admin_users(tenant_id);
CREATE INDEX idx_admin_users_email ON admin_users(email);
CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_product ON tenants(product);
