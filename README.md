# Twin Admin — Multi-Tenant Control Platform

Unified admin control system for **SurgiTwin Pro** and **GlowMorph Studio**.

## Features

- Doctor onboarding
- Licensing tiers
- Usage tracking (twins, exports, AR sessions, GPU)
- Storage quotas
- GPU inference billing
- Patient twin count tracking
- AR session tracking
- Export tracking
- Subscription management
- Stripe integration
- Local deployment license key system
- White-label option
- Role-based access control (RBAC)

## Quick Start

```bash
cp .env.example .env
docker compose up -d
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Admin UI Structure](docs/ADMIN_UI_STRUCTURE.md)
- [License Keys](docs/LICENSE_KEYS.md)
- [API Reference](docs/API.md)
- [Billing Schema](infra/schema/README.md)
