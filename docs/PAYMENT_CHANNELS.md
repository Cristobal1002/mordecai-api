# Payment Channels — Documentación para el equipo

## Resumen

Los **Payment Channels** permiten que cada tenant (nuestro cliente) configure sus propios medios de pago (transferencia bancaria, Zelle, efectivo, link) para que el deudor pueda pagarles directamente.

**Nosotros NO procesamos pagos.** Solo mostramos instrucciones y generamos una **referencia única para conciliación** (memo/reference) para que el tenant pueda identificar a qué caso/lease aplicar el pago.

---

## 1. Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│  payment_channel_types (catálogo GLOBAL)                        │
│  - link, card, transfer, zelle, cash (+ custom vía backoffice)   │
│  - config_schema: define qué campos configurar y cómo mostrarlos │
│  - reference: template para memo (CASE-{caseId}, etc.)           │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    │ channel_type_id
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  tenant_payment_channels (config POR TENANT)                     │
│  - tenant_id, channel_type_id                                    │
│  - config (JSONB): valores reales (routing, account, etc.)       │
│  - is_active, sort_order                                         │
└─────────────────────────────────────────────────────────────────┘
```

### 1.1 Catálogo global (`payment_channel_types`)

- Definido por admin/backoffice (no por tenant).
- Tipos por defecto: `link`, `card`, `transfer`, `zelle`, `cash`.
- Cada tipo tiene `config_schema` (JSONB) que describe:
  - Qué campos debe llenar el tenant.
  - Cómo se muestran al deudor.
  - Qué referencia usar para conciliación.

### 1.2 Config por tenant (`tenant_payment_channels`)

- Cada tenant puede **habilitar** los tipos que quiere usar.
- Configura los valores (ej. cuentas bancarias, email Zelle, puntos de pago).
- El `config` se valida contra el `config_schema` del tipo.

---

## 2. Flujo completo

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Admin       │     │  Tenant          │     │  Deudor          │
│  (Backoffice)│     │  (Cliente)       │     │  (Residente)     │
└──────┬───────┘     └────────┬─────────┘     └────────┬─────────┘
       │                      │                        │
       │ 1. Crear tipos       │                        │
       │    globales           │                        │
       │ (opcional, ya hay     │                        │
       │  defaults)            │                        │
       │                      │                        │
       │                      │ 2. Seed o crear         │
       │                      │    canales              │
       │                      │                        │
       │                      │ 3. Configurar          │
       │                      │    (bancos, Zelle,     │
       │                      │     puntos, link)      │
       │                      │                        │
       │                      │                        │ 4. Recibe link
       │                      │                        │    de pago
       │                      │                        │
       │                      │                        │ 5. Verifica
       │                      │                        │    identidad
       │                      │                        │
       │                      │                        │ 6. Ve instrucciones
       │                      │                        │    + referencia
       │                      │                        │
       │                      │                        │ 7. Copia referencia
       │                      │                        │    y paga
       │                      │                        │
       │                      │ 8. Recibe pago         │
       │                      │    con memo            │
       │                      │                        │
       │                      │ 9. Reconciliación:    │
       │                      │    memo → caso         │
       │                      │                        │
```

---

## 3. Referencia para conciliación

### 3.1 ¿Por qué?

Sin referencia, el tenant recibe el dinero pero no sabe a qué caso aplicarlo. Con el memo `CASE-{caseId}`, puede identificar el caso automáticamente.

### 3.2 Placeholders en el template

| Placeholder | Descripción |
|-------------|-------------|
| `{casePublicId}` | **Recomendado para memo.** ID corto legible (ej. `MC-4F2K9Q`). Evita UUID en vista deudor. |
| `{caseId}` | UUID del debt case |
| `{debtorId}` | ID del deudor |
| `{tenantId}` | ID del tenant |
| `{leaseExternalId}` | ID externo del lease en el PMS (si existe) |

### 3.3 referenceOverride (tenant)

El template por defecto vive en `config_schema.reference.template` (ej. `MC-{casePublicId}`). Un tenant puede **sobreescribirlo** en su config:

```json
{
  "config": {
    "banks": [...],
    "referenceOverride": {
      "template": "LEASE-{leaseExternalId}"
    }
  }
}
```

Si `referenceOverride.template` está definido, se usa en lugar del template del schema. Útil cuando el tenant prefiere su propio formato (ej. lease ID del PMS).

### 3.4 Ejemplo

Template: `MC-{casePublicId}`  
Contexto: casePublicId = `4F2K9Q`  
Resultado: `MC-4F2K9Q`

El deudor incluye esto en el memo de la transferencia/Zelle. El tenant busca ese string en su sistema bancario y aplica el pago al caso correcto.

### 3.5 `requiresReconciliation`

| Valor | Significado |
|-------|-------------|
| `true` | El deudor paga fuera del sistema (transfer, Zelle, cash). El tenant debe conciliar manualmente. |
| `false` | El pago pasa por un sistema (Stripe, PMS, link) que notifica automáticamente. |

---

## 4. ConfigSchema

### 4.1 Estructura

```json
{
  "fields": [
    {
      "key": "banks",
      "type": "array",
      "label": "Bank accounts",
      "required": true,
      "minItems": 1,
      "requireExactlyOnePrimary": true,
      "copyable": true,
      "itemFields": [
        {"key": "accountHolder", "type": "string", "label": "Beneficiary", "required": true, "copyable": true, "scope": "debtor"},
        {"key": "routingNumber", "type": "string", "label": "Routing number", "required": true, "validation": {"pattern": "^[0-9]{9}$"}, "hint": "9-digit ABA routing number", "scope": "debtor"},
        {"key": "accountType", "type": "select", "label": "Account type", "required": true, "options": ["checking", "savings"], "scope": "debtor"},
        {"key": "accountNumber", "type": "string", "label": "Account number", "required": true, "sensitive": true, "scope": "debtor"},
        {"key": "isPrimary", "type": "boolean", "label": "Primary (show to debtor)", "required": true, "scope": "tenant_admin"},
        {"key": "internalNotes", "type": "text", "label": "Internal notes", "scope": "tenant_admin"},
        {"key": "estimatedPostingTime", "type": "select", "label": "Estimated posting time", "options": ["same_day","1-2_business_days","1-3_business_days"], "optionLabels": {"same_day":"Same day","1-2_business_days":"1-2 business days","1-3_business_days":"1-3 business days"}, "scope": "debtor"}
      ]
    }
  ],
  "reference": {
    "required": true,
    "copyable": true,
    "label": "Memo / Reference",
    "template": "MC-{casePublicId}",
    "helpText": "Include this in the memo so we can apply your payment.",
    "placeholders": ["casePublicId", "caseId", "debtorId", "tenantId", "leaseExternalId"]
  }
}
```

### 4.2 Tipos de campo

| type | Uso |
|------|-----|
| `string` | Texto corto |
| `text` | Textarea |
| `number` | Número |
| `boolean` | Checkbox |
| `select` | Dropdown; requiere `options: ["a","b"]`. Opcional `optionLabels: {"a":"Label A"}` para display amigable. |
| `array` | Lista de objetos (ej. bancos, puntos) con `itemFields` |

### 4.3 Metadata por campo

| key | Descripción |
|-----|-------------|
| `required` | Campo obligatorio |
| `copyable` | Mostrar botón Copy en vista deudor. En arrays, se usa el copyable de cada itemField; el copyable del array es redundante (no se muestra Copy en el container). |
| `sensitive` | **Admin UI:** enmascarar (****6789) + botón reveal. **Deudor UI:** se muestra completo (es para pagar). |
| `hint` | Texto de ayuda (ej. "9-digit ABA routing number") |
| `validation.pattern` | Regex para validar |
| `validation.dependsOn` + `validation.patternByField` | Validación condicional: si `dependsOn: "handleType"` y `patternByField: {"email": "...", "phone": "..."}`, se usa el patrón según el valor del campo hermano (ej. Zelle handleValue). Se aplica trim() antes de validar. |
| `dynamicLabelByField` | Label dinámico según otro campo: `{"handleType": {"email": "Zelle email", "phone": "Zelle phone"}}`. |
| `dynamicHintByField` | Hint dinámico según otro campo: `{"handleType": {"email": "...", "phone": "US phone in E.164 format: +1XXXXXXXXXX"}}`. |
| `reminderWhenTrue` | Para boolean scope debtor: cuando true, se muestra como "Reminder" con el texto indicado (ej. "Request a receipt when paying"). |
| `scope` | `debtor` = visible al deudor; `tenant_admin` = solo en config UI (ej. "internal notes") |
| `isPrimary` / `isDefault` | En arrays (ej. banks): marca la cuenta primaria. En debtor UI se muestra solo la primaria (+ "X more accounts" si hay más). |
| `minItems` | En arrays: mínimo de elementos (ej. 1 para banks) |
| `requireExactlyOnePrimary` | En arrays: exactamente un item debe tener isPrimary (evita 0 o 2 primarias). isPrimary debe ser `required: true` a nivel item. |

### 4.4 referenceOverride en config tenant

Cuando el schema tiene `reference`, el tenant puede guardar en su `config`:

```json
{
  "referenceOverride": {
    "template": "LEASE-{leaseExternalId}"
  }
}
```

Opcional. Si no existe, se usa el template del schema.

---

## 5. API Endpoints

### 5.1 Backoffice (sin auth)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/backoffice/payment-channel-types` | Listar tipos globales |
| GET | `/api/v1/backoffice/payment-channel-types/:id` | Obtener un tipo |
| POST | `/api/v1/backoffice/payment-channel-types` | Crear tipo global |
| PUT | `/api/v1/backoffice/payment-channel-types/:id` | Actualizar tipo |
| DELETE | `/api/v1/backoffice/payment-channel-types/:id` | Eliminar tipo |

### 5.2 Tenant (con auth)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/tenants/:tenantId/payment-channels` | Listar canales del tenant |
| GET | `/api/v1/tenants/:tenantId/payment-channels/:channelId` | Obtener un canal |
| POST | `/api/v1/tenants/:tenantId/payment-channels` | Crear canal |
| PUT | `/api/v1/tenants/:tenantId/payment-channels/:channelId` | Actualizar canal (incl. config) |
| DELETE | `/api/v1/tenants/:tenantId/payment-channels/:channelId` | Eliminar canal |
| POST | `/api/v1/tenants/:tenantId/payment-channels/seed-defaults` | Crear todos los canales por defecto |

### 5.3 Deudor / Agente

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/pay/:token/details` | Detalles del caso + instrucciones (requiere Bearer paySessionToken) |
| GET | `/api/v1/debt-cases/payment-instructions/:caseId` | Instrucciones para un caso (auth tenant). El tenant se infiere del usuario autenticado; evita inseguridad por path params. |

---

## 6. Ejemplos cURL

### Crear tipo global

```bash
curl -X POST "http://localhost:3000/api/v1/backoffice/payment-channel-types" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "stripe",
    "label": "Stripe",
    "requiresReconciliation": false,
    "sortOrder": 5,
    "configSchema": {
      "fields": [{"key": "apiKey", "type": "string", "label": "API Key", "required": true}],
      "reference": {"required": false, "label": "Memo", "template": "CASE-{caseId}"}
    },
    "isEnabled": true
  }'
```

### Crear tipo global (Zelle)

```bash
curl -X POST "http://localhost:3000/api/v1/backoffice/payment-channel-types" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "zelle",
    "label": "Zelle",
    "requiresReconciliation": true,
    "sortOrder": 2,
    "configSchema": {
      "fields": [
        {
          "key": "recipients",
          "type": "array",
          "label": "Zelle recipients",
          "required": true,
          "minItems": 1,
          "requireExactlyOnePrimary": true,
          "itemFields": [
            {"key": "recipientName", "type": "string", "label": "Recipient name", "required": true, "copyable": true, "scope": "debtor"},
            {"key": "handleType", "type": "select", "label": "Send to", "required": true, "options": ["email", "phone"], "scope": "debtor"},
            {"key": "handleValue", "type": "string", "label": "Email or phone", "required": true, "copyable": true, "hint": "Use email or US phone (+1...)", "scope": "debtor", "validation": {"dependsOn": "handleType", "patternByField": {"email": "^[^@]+@[^@]+\\.[^@]+$", "phone": "^\\+1[0-9]{10}$"}}},
            {"key": "instructions", "type": "text", "label": "Instructions", "required": false, "scope": "debtor"},
            {"key": "estimatedPostingTime", "type": "select", "label": "Estimated posting time", "required": false, "scope": "debtor", "options": ["minutes", "same_day"], "optionLabels": {"minutes": "Minutes", "same_day": "Same day"}},
            {"key": "internalNotes", "type": "text", "label": "Internal notes", "required": false, "scope": "tenant_admin"},
            {"key": "isPrimary", "type": "boolean", "label": "Primary (show to debtor)", "required": true, "scope": "tenant_admin"}
          ]
        }
      ],
      "reference": {
        "required": true,
        "copyable": true,
        "label": "Memo / Reference",
        "template": "MC-{casePublicId}",
        "helpText": "Include this in the memo so we can apply your payment. If Zelle limits memo length, use the short code above.",
        "placeholders": ["caseId", "casePublicId", "debtorId", "tenantId", "leaseExternalId"]
      }
    },
    "isEnabled": true
  }'
```

### Crear tipo global (Cash)

```bash
curl -X POST "http://localhost:3000/api/v1/backoffice/payment-channel-types" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "cash",
    "label": "Cash payment",
    "requiresReconciliation": true,
    "sortOrder": 3,
    "configSchema": {
      "fields": [
        {
          "key": "locations",
          "type": "array",
          "label": "Cash payment locations",
          "required": true,
          "minItems": 1,
          "requireExactlyOnePrimary": true,
          "itemFields": [
            {"key": "locationName", "type": "string", "label": "Location name", "required": true, "copyable": true, "scope": "debtor"},
            {"key": "recipientName", "type": "string", "label": "Pay to (recipient)", "required": true, "copyable": true, "scope": "debtor"},
            {"key": "addressLine1", "type": "string", "label": "Address line 1", "required": true, "copyable": true, "scope": "debtor"},
            {"key": "addressLine2", "type": "string", "label": "Address line 2", "required": false, "copyable": true, "scope": "debtor"},
            {"key": "city", "type": "string", "label": "City", "required": true, "copyable": true, "scope": "debtor"},
            {"key": "state", "type": "string", "label": "State", "required": true, "copyable": true, "validation": {"pattern": "^[A-Z]{2}$"}, "hint": "2-letter state code (e.g. CA, FL)", "scope": "debtor"},
            {"key": "zip", "type": "string", "label": "ZIP code", "required": true, "copyable": true, "validation": {"pattern": "^[0-9]{5}(-[0-9]{4})?$"}, "hint": "e.g. 94105 or 94105-1234", "scope": "debtor"},
            {"key": "hours", "type": "text", "label": "Hours", "required": false, "scope": "debtor"},
            {"key": "phone", "type": "string", "label": "Phone (optional)", "required": false, "copyable": true, "hint": "e.g. +1...", "scope": "debtor"},
            {"key": "instructions", "type": "text", "label": "Instructions", "required": false, "scope": "debtor"},
            {"key": "requiresReceipt", "type": "boolean", "label": "Always request a receipt", "required": false, "scope": "debtor"},
            {"key": "internalNotes", "type": "text", "label": "Internal notes", "required": false, "scope": "tenant_admin"},
            {"key": "isPrimary", "type": "boolean", "label": "Primary (show to debtor)", "required": true, "scope": "tenant_admin"}
          ]
        }
      ],
      "reference": {
        "required": true,
        "copyable": true,
        "label": "Payment reference code",
        "template": "MC-{casePublicId}",
        "helpText": "Show this code when paying so we can apply your payment correctly. Ask for a receipt.",
        "placeholders": ["caseId", "casePublicId", "debtorId", "tenantId", "leaseExternalId"]
      }
    },
    "isEnabled": true
  }'
```

**Nota:** En JSON dentro de bash, el regex del ZIP usa `[0-9]`. En Postman/JSON normal: `^\d{5}(-\d{4})?$`.

### Crear tipo global (Check)

```bash
curl -X POST "http://localhost:3000/api/v1/backoffice/payment-channel-types" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "check",
    "label": "Check (mail or drop-off)",
    "requiresReconciliation": true,
    "sortOrder": 4,
    "configSchema": {
      "fields": [
        {"key": "payeeName", "type": "string", "label": "Payee (who to write the check to)", "required": true, "copyable": true, "scope": "debtor"},
        {"key": "companyName", "type": "string", "label": "Company name (optional)", "required": false, "copyable": true, "scope": "debtor"},
        {"key": "memoHint", "type": "text", "label": "What to write in memo (optional)", "required": false, "scope": "debtor"},
        {"key": "internalNotes", "type": "text", "label": "Internal notes", "required": false, "scope": "tenant_admin"},
        {
          "key": "deliveryMethods",
          "type": "array",
          "label": "Where to send / drop off the check",
          "required": true,
          "minItems": 1,
          "requireExactlyOnePrimary": true,
          "copyable": true,
          "itemFields": [
            {"key": "methodType", "type": "select", "label": "Method", "required": true, "options": ["mail", "drop_off"], "optionLabels": {"mail": "Mail", "drop_off": "Drop-off"}, "scope": "debtor"},
            {"key": "methodName", "type": "string", "label": "Location name", "required": true, "copyable": true, "scope": "debtor"},
            {"key": "addressLine1", "type": "string", "label": "Address line 1", "required": true, "copyable": true, "hint": "Street address or PO Box", "scope": "debtor"},
            {"key": "addressLine2", "type": "string", "label": "Address line 2", "required": false, "copyable": true, "scope": "debtor"},
            {"key": "city", "type": "string", "label": "City", "required": true, "copyable": true, "scope": "debtor"},
            {"key": "state", "type": "string", "label": "State", "required": true, "copyable": true, "validation": {"pattern": "^[A-Z]{2}$"}, "hint": "2-letter state code (e.g. CA, FL)", "scope": "debtor"},
            {"key": "zip", "type": "string", "label": "ZIP code", "required": true, "copyable": true, "validation": {"pattern": "^[0-9]{5}(-[0-9]{4})?$"}, "hint": "e.g. 94105 or 94105-1234", "scope": "debtor"},
            {"key": "attn", "type": "string", "label": "ATTN (optional)", "required": false, "copyable": true, "hint": "e.g. Attn: Accounts Receivable", "scope": "debtor"},
            {"key": "instructions", "type": "text", "label": "Instructions", "required": false, "scope": "debtor"},
            {"key": "hours", "type": "text", "label": "Hours (drop-off only)", "required": false, "hint": "e.g. Mon–Fri 9am–5pm", "scope": "debtor"},
            {"key": "phone", "type": "string", "label": "Phone (optional)", "required": false, "copyable": true, "hint": "e.g. +1...", "scope": "debtor"},
            {"key": "internalNotes", "type": "text", "label": "Internal notes", "required": false, "scope": "tenant_admin"},
            {"key": "isPrimary", "type": "boolean", "label": "Primary (show to debtor)", "required": true, "scope": "tenant_admin"}
          ]
        }
      ],
      "reference": {
        "required": true,
        "copyable": true,
        "label": "Memo / Reference",
        "template": "MC-{casePublicId}",
        "helpText": "Write this code in the memo line of your check so we can apply your payment correctly.",
        "placeholders": ["caseId", "casePublicId", "debtorId", "tenantId", "leaseExternalId"]
      }
    },
    "isEnabled": true
  }'
```

### Crear canal tenant (transfer)

```bash
curl -X POST "http://localhost:3000/api/v1/tenants/TENANT_ID/payment-channels" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -d '{
    "code": "transfer",
    "label": "Bank transfer",
    "requiresReconciliation": true,
    "config": {
      "banks": [{
        "accountHolder": "Acme Corp",
        "bankName": "Chase",
        "routingNumber": "021000021",
        "accountNumber": "1234567890",
        "accountType": "checking"
      }]
    },
    "isActive": true
  }'
```

### Seed canales por defecto

```bash
curl -X POST "http://localhost:3000/api/v1/tenants/TENANT_ID/payment-channels/seed-defaults" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -d '{}'
```

### Obtener instrucciones de pago (deudor)

```bash
# 1. Verificar identidad
curl -X POST "http://localhost:3000/pay/TOKEN/verify" \
  -H "Content-Type: application/json" \
  -d '{"lastName": "Smith", "unitNumber": "101"}'

# 2. Obtener detalles (incluye paymentInstructions)
curl -X GET "http://localhost:3000/pay/TOKEN/details" \
  -H "Authorization: Bearer PAY_SESSION_TOKEN"
```

---

## 7. Frontend

### 7.1 Tenant UI (Payment Channels)

- **Ruta:** `/payment-channels`
- **Funciones:** listar canales, crear por defecto, configurar cada canal (form dinámico según `configSchema`).
- **Componente:** `DynamicConfigForm` renderiza campos según el schema.

### 7.2 Deudor UI (pay link)

- **Ruta:** `/p/[token]`
- **Flujo:** verificar identidad → ver detalles + instrucciones.
- **Instrucciones:** cards por canal con datos bancarios/Zelle/puntos, referencia destacada con botón Copy.
- **Banks/Recipients/Locations:** si hay múltiples, se muestra solo la primaria (`isPrimary: true`); si hay más, se indica "X more accounts/recipients/locations".
- **Cash:** card con location primaria, address copyable, reference code. Mensaje: "Bring the reference code and request a receipt."
- **Scope:** solo se muestran campos con `scope: debtor`; los de `tenant_admin` (ej. internal notes) quedan ocultos.

---

## 8. Migraciones

- **045:** Crea `payment_channel_types` y `channel_type_id` en `tenant_payment_channels`. Seed de tipos por defecto.
- **046:** Añade bloque `reference` y metadata (`copyable`, `sensitive`, `validation`) al `config_schema` de transfer, zelle, cash, link.
- **047:** Añade `case_public_id` en `debt_cases` (VARCHAR(16) UNIQUE, formato `MC-XXXXXX`). Backfill + trigger para INSERT.
- **048:** Actualiza `config_schema`: template `MC-{casePublicId}`, `isPrimary` en banks, `scope` (debtor/tenant_admin) en itemFields.
- **049:** Refina transfer para USA: accountType select (checking|savings), banks.required + minItems + requireExactlyOnePrimary, routing hint, reference.copyable.
- **050:** Zelle recipients array (recipientName, handleType, handleValue, instructions, estimatedPostingTime, internalNotes, isPrimary). Migra email/phone → recipients.
- **051:** Cash locations array (locationName, recipientName, address, city, state, zip, hours, phone, instructions, requiresReceipt, internalNotes, isPrimary). Migra points → locations.
- **052:** Check channel (payeeName, companyName, memoHint, deliveryMethods mail/drop-off). Payee como campos planos; deliveryMethods como array.

---

## 9. Validación

Al actualizar el `config` de un canal, se valida contra el `config_schema`:

- Campos requeridos presentes.
- Patrones (ej. routing 9 dígitos).
- Si falla: `400 Bad Request` con mensajes de error.

---

## 10. Checklist para nuevos canales

1. Crear tipo en `payment_channel_types` (migración o backoffice).
2. Definir `config_schema.fields` y `config_schema.reference`.
3. Si `requiresReconciliation = true`, incluir `reference.template`.
4. El tenant hace seed o crea el canal manualmente.
5. El tenant configura los valores (config).
6. Las instrucciones aparecen en el flujo de pago del deudor.
