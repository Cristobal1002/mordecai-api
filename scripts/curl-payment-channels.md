# cURL para crear canales de pago

Reemplaza `TENANT_ID` y `AUTH_TOKEN` (o usa cookies). Base URL por defecto: `http://localhost:3000`.

## Crear canales individuales

### Transfer (transferencia bancaria)
```bash
curl -X POST "http://localhost:3000/api/v1/tenants/TENANT_ID/payment-channels" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer AUTH_TOKEN" \
  -d '{
    "code": "transfer",
    "label": "Bank transfer",
    "requiresReconciliation": true,
    "sortOrder": 2,
    "config": {},
    "isActive": true
  }'
```

### Zelle
```bash
curl -X POST "http://localhost:3000/api/v1/tenants/TENANT_ID/payment-channels" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer AUTH_TOKEN" \
  -d '{
    "code": "zelle",
    "label": "Zelle",
    "requiresReconciliation": true,
    "sortOrder": 3,
    "config": {},
    "isActive": true
  }'
```

### Cash (pago físico)
```bash
curl -X POST "http://localhost:3000/api/v1/tenants/TENANT_ID/payment-channels" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer AUTH_TOKEN" \
  -d '{
    "code": "cash",
    "label": "Physical payment",
    "requiresReconciliation": true,
    "sortOrder": 4,
    "config": {},
    "isActive": true
  }'
```

### Link (link de pago)
```bash
curl -X POST "http://localhost:3000/api/v1/tenants/TENANT_ID/payment-channels" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer AUTH_TOKEN" \
  -d '{
    "code": "link",
    "label": "Payment link",
    "requiresReconciliation": false,
    "sortOrder": 0,
    "config": {},
    "isActive": true
  }'
```

## Crear todos los canales por defecto (seed)

```bash
curl -X POST "http://localhost:3000/api/v1/tenants/TENANT_ID/payment-channels/seed-defaults" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer AUTH_TOKEN" \
  -d '{}'
```

## Obtener token de autenticación

1. Inicia sesión en el frontend (http://localhost:8080 o tu URL).
2. Abre DevTools → Application → Cookies y copia `access_token`.
3. O usa la pestaña Network, busca una petición autenticada y copia el header `Authorization: Bearer ...`.
