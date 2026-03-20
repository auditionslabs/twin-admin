-- Twin Admin - Billing & Subscription Schema

-- =============================================================================
-- LICENSING TIERS
-- =============================================================================

CREATE TABLE license_tiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product tenant_product NOT NULL,
    tier tenant_tier NOT NULL,
    name VARCHAR(100) NOT NULL,
    max_doctors INTEGER,
    max_patients INTEGER,
    max_twins INTEGER,
    storage_gb INTEGER,
    gpu_hours_per_month DECIMAL(10,2),
    exports_per_month INTEGER,
    ar_sessions_per_month INTEGER,
    price_monthly_cents INTEGER,
    price_yearly_cents INTEGER,
    stripe_price_id_monthly VARCHAR(100),
    stripe_price_id_yearly VARCHAR(100),
    features JSONB DEFAULT '[]',
    UNIQUE(product, tier)
);

-- =============================================================================
-- SUBSCRIPTIONS (Stripe)
-- =============================================================================

CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    stripe_customer_id VARCHAR(100),
    stripe_subscription_id VARCHAR(100),
    stripe_price_id VARCHAR(100),
    tier tenant_tier NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',  -- active, past_due, canceled, trialing
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id)
);

CREATE INDEX idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);

-- =============================================================================
-- LOCAL DEPLOYMENT LICENSES
-- =============================================================================

CREATE TABLE license_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    key_hash VARCHAR(64) NOT NULL UNIQUE,     -- SHA-256 of full key
    key_prefix VARCHAR(8) NOT NULL,           -- First 8 chars for lookup
    license_type license_type NOT NULL,
    tier tenant_tier NOT NULL,
    product tenant_product NOT NULL,
    max_doctors INTEGER,
    max_patients INTEGER,
    max_twins INTEGER,
    storage_gb INTEGER,
    gpu_hours_per_month DECIMAL(10,2),
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE license_activations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_key_id UUID NOT NULL REFERENCES license_keys(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    deployment_id VARCHAR(100) NOT NULL,     -- Host fingerprint / instance ID
    activated_at TIMESTAMPTZ DEFAULT NOW(),
    last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(license_key_id, deployment_id)
);

CREATE INDEX idx_license_keys_prefix ON license_keys(key_prefix);
CREATE INDEX idx_license_keys_hash ON license_keys(key_hash);
CREATE INDEX idx_license_keys_tenant ON license_keys(tenant_id);
CREATE INDEX idx_license_activations_license ON license_activations(license_key_id);
