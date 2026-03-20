# Twin Admin — API Reference

## Base URL

`/api/v1`

## Auth

All endpoints (except license validation) require:

```
Authorization: Bearer <admin_jwt>
```

## License Validation (Public)

Products (SurgiTwin Pro, GlowMorph Studio) call this for local deployment license checks.

### Validate Key

```
POST /api/licenses/validate
Content-Type: application/json

{
  "key": "XXXX-XXXX-XXXX-XXXX-XXXX",
  "deployment_id": "host-fingerprint-or-instance-id",
  "product": "surgitwin" | "glowmorph"
}

Response 200:
{
  "valid": true,
  "tier": "professional",
  "limits": {
    "max_doctors": 15,
    "max_twins": 1000,
    "storage_gb": 500,
    "gpu_hours_per_month": 100
  },
  "expires_at": "2026-12-31T23:59:59Z",
  "activation_id": "uuid"
}

Response 400:
{
  "valid": false,
  "error": "License expired"
}
```

### Heartbeat

```
POST /api/licenses/heartbeat
Content-Type: application/json

{
  "activation_id": "uuid",
  "deployment_id": "host-fingerprint"
}

Response 200: { "ok": true }
Response 403: { "error": "License revoked" }
```

## Usage Events (Products Push)

SurgiTwin Pro and GlowMorph Studio push usage events for aggregation.

```
POST /api/usage/events
Authorization: Bearer <product_api_key>
Content-Type: application/json

{
  "tenant_id": "uuid",
  "product": "surgitwin" | "glowmorph",
  "events": [
    {
      "event_type": "twin_created" | "export" | "ar_session" | "gpu_seconds" | "storage_bytes",
      "resource_id": "uuid",
      "quantity": 1
    }
  ]
}
```

## Tenants

| Method | Path | Description |
|--------|------|-------------|
| GET | /tenants | List tenants (platform admin) |
| POST | /tenants | Create tenant |
| GET | /tenants/:id | Get tenant |
| PATCH | /tenants/:id | Update tenant |
| GET | /tenants/:id/usage | Usage snapshot |
| GET | /tenants/:id/billing | Subscription, invoices |

## Licenses (Admin)

| Method | Path | Description |
|--------|------|-------------|
| GET | /licenses | List license keys |
| POST | /licenses/generate | Generate new key |
| POST | /licenses/:id/revoke | Revoke key |
| GET | /licenses/:id/activations | List activations |

## Stripe Webhooks

`POST /api/webhooks/stripe` — Idempotent handling of `customer.subscription.*`, `invoice.*`, etc.
