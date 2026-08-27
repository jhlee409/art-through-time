# Firebase Migration Preparation

The local collection remains the source of truth until the public application is deployed.

## Current status

Firebase support is deliberately dormant: the application does not show an export button and does not connect to Firebase at runtime. Keep the export contract and preparation tool in place for a future database-platform decision; do not delete or run them as part of ordinary content editing. Before an actual migration, review the exported schema, image-status report, authentication design, and backup/rollback plan.

## Current contract

- Artist and artwork IDs are stable and must never be changed during migration.
- `metadata` records creation and update timestamps plus the local editor identifier.
- `migration.image.status` is `ready`, `pending`, or `missing`.
- `migration.image.sourceUrls` preserves original image and research sources.
- `data/access-control.json` contains local role assignments. Firebase Authentication and custom claims replace this file after deployment.

## Validate and export

Run the following from the project folder:

```powershell
node tools/prepare-firebase-migration.js --write
```

Run the read-only health check first:

```powershell
node tools/check-project-health.js
```

This normalizes the local data and creates these migration artifacts:

- `data/migration-assets.json`: local image-file manifest
- `data/migration-report.json`: ID, image-status, and source validation report
- `exports/firebase-import-latest.json`: Firestore-ready artist, artwork, movement, role, and storage-manifest data

The export references local image files. Upload those referenced files to Firebase Storage with a future import script; it intentionally does not duplicate the image binaries.
