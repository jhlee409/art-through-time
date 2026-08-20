# Firebase Migration Preparation

The local collection remains the source of truth until the public application is deployed.

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

This normalizes the local data and creates these migration artifacts:

- `data/migration-assets.json`: local image-file manifest
- `data/migration-report.json`: ID, image-status, and source validation report
- `exports/firebase-import-latest.json`: Firestore-ready artist, artwork, movement, role, and storage-manifest data

The export references local image files. Upload those referenced files to Firebase Storage with a future import script; it intentionally does not duplicate the image binaries.
