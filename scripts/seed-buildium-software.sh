#!/usr/bin/env bash
# Seed Buildium en el catálogo de softwares.
# Requiere: API corriendo en BASE_URL (por defecto http://localhost:3000).
# Uso: ./scripts/seed-buildium-software.sh [BASE_URL]
#
# Credenciales Buildium: Client ID y Secret en headers
#   x-buildium-client-id, x-buildium-client-secret
# Obtención: Settings > Developer Tools > Create API Key (cuenta con Open API habilitada).

set -e
BASE_URL="${1:-http://localhost:3000}"
API="${BASE_URL}/api/v1"

echo "Creating Buildium software at ${API}/catalog/softwares ..."
curl -s -X POST "${API}/catalog/softwares" \
  -H "Content-Type: application/json" \
  -d '{
  "key": "buildium",
  "name": "Buildium",
  "category": "property_manager",
  "authType": "apiKey",
  "authConfig": {
    "requiredFields": ["clientId", "clientSecret"],
    "headerNames": {
      "clientId": "x-buildium-client-id",
      "clientSecret": "x-buildium-client-secret"
    },
    "description": "API key: client ID and secret sent in request headers. Enable Open API in Settings > Application settings > Api settings; create keys in Settings > Developer Tools > Create API Key."
  },
  "capabilities": {
    "supportsExportLeases": true,
    "supportsExportProperties": true,
    "supportsExportUnits": true,
    "supportsExportApplications": true,
    "supportsUpdatedSince": true,
    "exportDateField": "ModifiedDateTime",
    "supportsAccounting": true,
    "supportsContacts": true,
    "supportsFilesUpload": true,
    "supportsLeases": true,
    "supportsMaintenance": true,
    "supportsPortfolios": true,
    "supportsProperties": true,
    "supportsUnits": true,
    "supportsAssociations": true,
    "supportsListings": true,
    "supportsApplicants": true
  },
  "logoUrl": "https://developer.buildium.com/Buildium-RP-Color-Logo.png",
  "docsUrl": "https://developer.buildium.com/",
  "isEnabled": true
}' | (command -v jq >/dev/null && jq . || cat)

echo "Done."
