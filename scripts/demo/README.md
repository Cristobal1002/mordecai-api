# Demo Scripts

## 1) Generate synthetic demo data

```bash
chmod +x scripts/demo/seed_demo_data.sh
./scripts/demo/seed_demo_data.sh \
  --tenant-name "Demo PM" \
  --debtor-name "German Simon Marin" \
  --debtor-email "german.demo@example.com" \
  --debtor-phone "+573001112233" \
  --amount-usd 5000 \
  --days-past-due 12
```

This prints IDs on screen and creates a file like:

```text
./demo_ids_20260213_170000.txt
```

Use that file later for cleanup.

## 2) Cleanup demo data

```bash
chmod +x scripts/demo/cleanup_demo_data.sh
./scripts/demo/cleanup_demo_data.sh --ids-file ./demo_ids_20260213_170000.txt
```

## Required env vars (both scripts)

```bash
export DB_HOST=...
export DB_PORT=5432
export DB_NAME=...
export DB_USER=...
export DB_PASSWORD=...
```
