#!/usr/bin/env bash
# Crea canales de pago individuales (transfer, zelle, cash, link).
# Requiere: API corriendo, usuario autenticado.
# Uso: ./scripts/seed-payment-channels.sh [BASE_URL] [TENANT_ID]
#
# Autenticación: usa cookies del navegador o Bearer token.
# Ejemplo con token: export AUTH_TOKEN="eyJ..." antes de ejecutar.
# Ejemplo con cookies: export AUTH_COOKIE="access_token=eyJ...; csrf_token=..."

set -e
BASE_URL="${1:-http://localhost:3000}"
TENANT_ID="${2:?TENANT_ID required}"
API="${BASE_URL}/api/v1"

EXTRA_HEADERS=()
if [ -n "$AUTH_TOKEN" ]; then
  EXTRA_HEADERS+=(-H "Authorization: Bearer $AUTH_TOKEN")
elif [ -n "$AUTH_COOKIE" ]; then
  EXTRA_HEADERS+=(-H "Cookie: $AUTH_COOKIE")
fi

echo "Creating payment channels for tenant $TENANT_ID at $API ..."

# Transfer (transferencia bancaria)
echo ""
echo "1. Transfer (transferencia bancaria)"
curl -s -X POST "${API}/tenants/${TENANT_ID}/payment-channels" \
  -H "Content-Type: application/json" \
  "${EXTRA_HEADERS[@]}" \
  -d '{
  "code": "transfer",
  "label": "Bank transfer",
  "requiresReconciliation": true,
  "sortOrder": 2,
  "config": {},
  "isActive": true
}' | (command -v jq >/dev/null && jq . || cat)

# Zelle
echo ""
echo "2. Zelle"
curl -s -X POST "${API}/tenants/${TENANT_ID}/payment-channels" \
  -H "Content-Type: application/json" \
  "${EXTRA_HEADERS[@]}" \
  -d '{
  "code": "zelle",
  "label": "Zelle",
  "requiresReconciliation": true,
  "sortOrder": 3,
  "config": {},
  "isActive": true
}' | (command -v jq >/dev/null && jq . || cat)

# Cash (pago físico)
echo ""
echo "3. Cash (pago físico)"
curl -s -X POST "${API}/tenants/${TENANT_ID}/payment-channels" \
  -H "Content-Type: application/json" \
  "${EXTRA_HEADERS[@]}" \
  -d '{
  "code": "cash",
  "label": "Physical payment",
  "requiresReconciliation": true,
  "sortOrder": 4,
  "config": {},
  "isActive": true
}' | (command -v jq >/dev/null && jq . || cat)

# Link (link de pago)
echo ""
echo "4. Link (link de pago)"
curl -s -X POST "${API}/tenants/${TENANT_ID}/payment-channels" \
  -H "Content-Type: application/json" \
  "${EXTRA_HEADERS[@]}" \
  -d '{
  "code": "link",
  "label": "Payment link",
  "requiresReconciliation": false,
  "sortOrder": 0,
  "config": {},
  "isActive": true
}' | (command -v jq >/dev/null && jq . || cat)

echo ""
echo "Done. Or use seed-defaults to create all at once:"
echo "  curl -X POST \"${API}/tenants/${TENANT_ID}/payment-channels/seed-defaults\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer \$AUTH_TOKEN\" -d '{}'"
