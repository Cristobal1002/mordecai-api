#!/usr/bin/env bash
# Seed Rentvine en el catálogo de softwares.
# Requiere: API corriendo en BASE_URL (por defecto http://localhost:3000).
# Uso: ./scripts/seed-rentvine-software.sh [BASE_URL]

set -e
BASE_URL="${1:-http://localhost:3000}"
API="${BASE_URL}/api/v1"

echo "Creating Rentvine software at ${API}/catalog/softwares ..."
curl -s -X POST "${API}/catalog/softwares" \
  -H "Content-Type: application/json" \
  -d '{
  "key": "rentvine",
  "name": "Rentvine",
  "category": "property_manager",
  "authType": "apiKey",
  "authConfig": {
    "requiredFields": ["accessKey", "secret"],
    "optionalFields": ["account"],
    "description": "HTTP Basic Auth: access key = username, secret = password. Account = subdomain (e.g. mycompany → mycompany.rentvine.com).",
    "docsUrl": "https://docs.rentvine.com/"
  },
  "capabilities": {
    "supportsExportLeases": true,
    "supportsExportProperties": true,
    "supportsExportUnits": true,
    "supportsExportApplications": true,
    "supportsUpdatedSince": true,
    "exportDateField": "dateTimeModified",
    "supportsAccounting": true,
    "supportsContacts": true,
    "supportsFilesUpload": true,
    "supportsLeases": true,
    "supportsMaintenance": true,
    "supportsPortfolios": true,
    "supportsProperties": true,
    "supportsUnits": true
  },
  "logoUrl": "https://production-rentvine-accounts-public.s3.amazonaws.com/_resources/logo.png",
  "docsUrl": "https://docs.rentvine.com/",
  "isEnabled": true
}' | (command -v jq >/dev/null && jq . || cat)

echo "Done."
