-- Twin Admin - Doctor Onboarding (SurgiTwin Pro)

-- =============================================================================
-- DOCTOR INVITES & ONBOARDING
-- =============================================================================

CREATE TABLE doctor_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    invite_token VARCHAR(64) UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    invited_by UUID REFERENCES admin_users(id),
    tier_override tenant_tier,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE doctor_onboarding_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    step_name VARCHAR(50) NOT NULL,           -- 'profile', 'license_verify', 'first_twin', etc.
    required BOOLEAN DEFAULT TRUE,
    order_index INTEGER DEFAULT 0,
    config JSONB DEFAULT '{}',
    UNIQUE(tenant_id, step_name)
);

CREATE TABLE doctor_onboarding_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    doctor_external_id VARCHAR(100) NOT NULL, -- Links to SurgiTwin users.id
    step_name VARCHAR(50) NOT NULL,
    completed_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    UNIQUE(tenant_id, doctor_external_id, step_name)
);

CREATE INDEX idx_doctor_invites_tenant ON doctor_invites(tenant_id);
CREATE INDEX idx_doctor_invites_token ON doctor_invites(invite_token);
CREATE INDEX idx_doctor_onboarding_tenant ON doctor_onboarding_progress(tenant_id);
