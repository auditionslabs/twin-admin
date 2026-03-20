-- Twin Admin - Invoicing & Stripe Events

-- =============================================================================
-- INVOICES
-- =============================================================================

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    stripe_invoice_id VARCHAR(100),
    stripe_invoice_pdf VARCHAR(512),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    subtotal_cents INTEGER NOT NULL,
    tax_cents INTEGER DEFAULT 0,
    total_cents INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',  -- draft, open, paid, void, uncollectible
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE invoice_line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description VARCHAR(255) NOT NULL,
    quantity DECIMAL(10,2) DEFAULT 1,
    unit_amount_cents INTEGER NOT NULL,
    total_cents INTEGER NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- STRIPE WEBHOOK LOG (Idempotency)
-- =============================================================================

CREATE TABLE stripe_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stripe_event_id VARCHAR(100) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    payload_hash VARCHAR(64),
    error_message TEXT
);

CREATE INDEX idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX idx_invoices_period ON invoices(period_start, period_end);
CREATE INDEX idx_stripe_events_id ON stripe_events(stripe_event_id);
