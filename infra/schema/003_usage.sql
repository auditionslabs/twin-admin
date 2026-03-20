-- Twin Admin - Usage Tracking Schema

-- =============================================================================
-- USAGE METRICS (Aggregated per tenant per period)
-- =============================================================================

CREATE TABLE usage_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product tenant_product NOT NULL,
    period_start DATE NOT NULL,               -- First day of billing period
    period_end DATE NOT NULL,
    twin_count INTEGER DEFAULT 0,
    patient_count INTEGER DEFAULT 0,
    doctor_count INTEGER DEFAULT 0,
    capture_sessions INTEGER DEFAULT 0,
    reconstruction_jobs INTEGER DEFAULT 0,
    simulation_runs INTEGER DEFAULT 0,
    render_jobs INTEGER DEFAULT 0,
    export_count INTEGER DEFAULT 0,
    ar_sessions INTEGER DEFAULT 0,
    gpu_seconds DECIMAL(12,2) DEFAULT 0,
    storage_bytes BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, product, period_start)
);

CREATE INDEX idx_usage_snapshots_tenant ON usage_snapshots(tenant_id);
CREATE INDEX idx_usage_snapshots_period ON usage_snapshots(period_start, period_end);

-- =============================================================================
-- REAL-TIME USAGE EVENTS (For aggregation and billing)
-- =============================================================================

CREATE TABLE usage_events (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product tenant_product NOT NULL,
    event_type VARCHAR(50) NOT NULL,          -- twin_created, export, ar_session, gpu_sec, etc.
    resource_id UUID,
    quantity DECIMAL(12,4) DEFAULT 1,
    metadata JSONB DEFAULT '{}',
    occurred_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usage_events_tenant ON usage_events(tenant_id, occurred_at DESC);
CREATE INDEX idx_usage_events_type ON usage_events(event_type, occurred_at DESC);

-- Partition by month for high-volume (optional)
-- CREATE TABLE usage_events_2025_03 PARTITION OF usage_events FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

-- =============================================================================
-- QUOTA TRACKING (Current vs limit)
-- =============================================================================

CREATE TABLE tenant_quotas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product tenant_product NOT NULL,
    quota_type VARCHAR(50) NOT NULL,         -- twins, storage_gb, gpu_hours, exports, ar_sessions
    limit_value DECIMAL(12,2) NOT NULL,
    current_value DECIMAL(12,2) DEFAULT 0,
    period_start DATE,
    period_end DATE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, product, quota_type, period_start)
);

CREATE INDEX idx_tenant_quotas_tenant ON tenant_quotas(tenant_id);
