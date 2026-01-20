# Firebase

## Emulator Ports

| Service | Port |
|---------|------|
| Auth | 9099 |
| Functions | 5001 |
| Firestore | 8080 |
| Hosting | 5000 |

## Emulator Commands

```bash
npm run firebase:emulators      # All emulators
npm run firebase:emulators:ui   # Auth/Firestore/Storage with UI
```

## Deploy Commands

```bash
npm run firebase:deploy              # Everything
npm run firebase:deploy:hosting      # Hosting only
npm run firebase:deploy:rules        # Rules only
npm run firebase:deploy:production   # Full production deploy (scripts/deploy-production.sh)
npm run firebase:deploy:dry-run      # Production dry-run
npm run firebase:deploy:staging      # Staging channel
```

## Rollback

```bash
npm run firebase:rollback            # Interactive
npm run firebase:rollback:emergency  # Auto-rollback to previous version
```

Rollback requires `jq` and `curl`. Supports `FORCE_ROLLBACK=true` to skip confirmation.

## Production Deploy Script

`scripts/deploy-production.sh`:
- Validates `.env.production` and security rules
- Runs unit tests
- Builds `out/`
- Deploys Firestore + Storage + Hosting

Flags: `--dry-run`, `--skip-tests`

## Rules Testing

```bash
npm run test:firestore-rules
npm run test:storage-rules
```

## Database Seeding

```bash
npm run db:seed   # Runs scripts/seed-firestore.ts via ts-node
```

## Node Version

Firebase Functions require Node 20. Use Node 20 for functions deploys/emulators.

## Live URL

https://schools-in-check.web.app
