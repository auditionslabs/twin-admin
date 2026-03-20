# Twin Admin — License Key System

## Overview

License keys control **local deployment** access for SurgiTwin Pro and GlowMorph Studio. Cloud deployments use Stripe subscriptions instead.

## Key Format

```
XXXX-XXXX-XXXX-XXXX-XXXX
```

- 25 characters, 5 groups of 4
- Charset: `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (no 0/O, 1/I/L)
- Last group = HMAC-SHA256 checksum of payload
- Prefix (first 8 chars) used for DB lookup; full key hashed (SHA-256) for storage

## License Types

| Type | Use Case |
|------|----------|
| `cloud_subscription` | Cloud-hosted, billed via Stripe |
| `local_perpetual` | On-prem, one-time purchase, no expiry |
| `local_subscription` | On-prem, annual renewal |
| `trial` | Time-limited eval |

## Generation

```bash
# Professional tier, local perpetual
node scripts/license-generator.js generate \
  --product surgitwin \
  --tier professional \
  --type local_perpetual

# With limits
node scripts/license-generator.js generate \
  --product surgitwin \
  --tier enterprise \
  --doctors 20 \
  --twins 500 \
  --storage 1000 \
  --gpu 100 \
  --expires 2026-12-31
```

## Validation Flow (Local Deployment)

1. User enters key in SurgiTwin/GlowMorph local setup
2. App calls Twin Admin API: `POST /api/licenses/validate`
3. Admin returns: `{ valid, tier, limits, expiresAt }`
4. App stores `activation_id` after first successful validation
5. Periodic heartbeat: `POST /api/licenses/heartbeat` with `activation_id`
6. Admin can revoke via dashboard → license revoked → next heartbeat fails

## Activation Limits

- **Perpetual:** 1 activation per key (single deployment)
- **Subscription:** Configurable (e.g., 3 deployments for enterprise)
- **Trial:** 1 activation, expires at `expires_at`

## Security

- Full key never stored; only `key_hash` and `key_prefix` in DB
- `LICENSE_SECRET` env var for HMAC; rotate invalidates all keys
- Heartbeat interval: 24h; 72h missed → soft lock, 7d → hard revoke
