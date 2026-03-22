-- Twin Admin - Stars / Wallet / AI Usage (Telegram Stars–style digital currency)
-- Tokens, cost tracking, markup on passthrough. Future: Telegram Stars exchange.

-- =============================================================================
-- WALLETS (stars balance per tenant)
-- =============================================================================

CREATE TABLE star_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    balance BIGINT NOT NULL DEFAULT 1000000,   -- 1M stars default
    currency VARCHAR(10) DEFAULT 'stars',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id)
);

CREATE INDEX idx_star_wallets_tenant ON star_wallets(tenant_id);

-- =============================================================================
-- USAGE LOG (AI token/cost – every request)
-- =============================================================================

CREATE TABLE ai_usage_log (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,             -- openai, elevenlabs, replicate, fal, heygen
    model VARCHAR(100),                         -- gpt-4o, cjwbw/sadtalker, etc.
    route VARCHAR(100),                         -- /api/demo/analyze, etc.
    tokens_in INTEGER,
    tokens_out INTEGER,
    cost_usd DECIMAL(12,6) NOT NULL DEFAULT 0,
    stars_charged BIGINT NOT NULL DEFAULT 0,
    balance_after BIGINT,
    metadata JSONB DEFAULT '{}',
    occurred_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_usage_tenant ON ai_usage_log(tenant_id, occurred_at DESC);
CREATE INDEX idx_ai_usage_provider ON ai_usage_log(provider, occurred_at DESC);

-- =============================================================================
-- STAR ADJUSTMENTS (purchases, Telegram Stars exchange, grants, refunds)
-- =============================================================================

CREATE TABLE star_adjustments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    amount BIGINT NOT NULL,                    -- positive = add, negative = deduct
    reason VARCHAR(100),                       -- purchase, grant, refund
    reference_id VARCHAR(100),                 -- stripe payment id, etc.
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_star_adjustments_tenant ON star_adjustments(tenant_id);
