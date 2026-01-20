# Core Models - Mordecai AI

## Resumen

Se ha implementado el core mínimo para una demo end-to-end del sistema de cobranza Mordecai AI con las siguientes características:

- ✅ 7 modelos Sequelize con soporte multi-tenant
- ✅ Migraciones SQL completas con enums, FKs, índices
- ✅ Asociaciones entre modelos configuradas
- ✅ Seed de flow_policies por tenant

## Modelos Implementados

### 1. **Tenant** (`tenant.model.js`)
- Tabla base para multi-tenant
- Campos: id (UUID), name, timezone, status (enum), settings (JSONB)

### 2. **Debtor** (`debtor.model.js`)
- Deudores/Cartera
- Campos: id, tenant_id, external_ref, full_name, email, phone, metadata (JSONB)
- Índices: (tenant_id, email), (tenant_id, phone), (tenant_id, external_ref)

### 3. **FlowPolicy** (`flow-policy.model.js`)
- Reglas de cobranza por rango de days_past_due
- Campos: id, tenant_id, name, min_days_past_due, max_days_past_due, channels (JSONB), tone, rules (JSONB), is_active

### 4. **ImportBatch** (`import-batch.model.js`)
- Auditoría de importación XLSX
- Campos: id, tenant_id, source (enum), file_key, status (enum), total_rows, success_rows, error_rows, errors (JSONB)

### 5. **DebtCase** (`debt-case.model.js`)
- Caso de cobranza (core)
- Campos: id, tenant_id, debtor_id, flow_policy_id, import_batch_id, amount_due_cents, currency, days_past_due, due_date, status (enum), last_contacted_at, next_action_at, payment_link_url, meta (JSONB), closed_at
- Múltiples índices para optimizar consultas

### 6. **PaymentAgreement** (`payment-agreement.model.js`)
- Acuerdos de pago
- Campos: id, tenant_id, debt_case_id, type (enum), status (enum), total_amount_cents, down_payment_cents, installments, start_date, promise_date, payment_link_url, provider (enum), provider_ref, terms (JSONB), created_by (enum)

### 7. **InteractionLog** (`interaction-log.model.js`)
- Registro de contacto omnicanal
- Campos: id, tenant_id, debt_case_id, debtor_id, type (enum), direction (enum), channel_provider, provider_ref, status, outcome (enum), started_at, ended_at, transcript, summary, ai_data (JSONB), error (JSONB)

## Características Técnicas

### ✅ Naming Convention
- Tablas en `snake_case`
- Sequelize configurado con `underscored: true`
- Campos en `snake_case` en la base de datos
- Modelos en `PascalCase` en el código

### ✅ Primary Keys
- Todos los modelos usan UUID v4 como PK
- `defaultValue: DataTypes.UUIDV4` en Sequelize

### ✅ Multi-tenant
- **TODAS** las tablas tienen `tenant_id` (FK a tenants.id)
- ON DELETE CASCADE para mantener integridad referencial

### ✅ JSONB Defaults
- Valores por defecto seguros: `{}` para objetos, `[]` para arrays
- Implementado tanto en modelos Sequelize como en migraciones SQL

### ✅ Foreign Keys
- Restricciones apropiadas:
  - `ON DELETE CASCADE` para relaciones fuertes (tenants → otros)
  - `ON DELETE RESTRICT` para prevenir eliminación accidental (debtors, debt_cases)
  - `ON DELETE SET NULL` para opcionales (flow_policy_id, import_batch_id)

## Estructura de Archivos

```
src/models/
├── tenant.model.js
├── debtor.model.js
├── flow-policy.model.js
├── import-batch.model.js
├── debt-case.model.js
├── payment-agreement.model.js
├── interaction-log.model.js
└── index.js (con todas las asociaciones)

migrations/
├── 001_create_tenants.sql
├── 002_create_debtors.sql
├── 003_create_flow_policies.sql
├── 004_create_import_batches.sql
├── 005_create_debt_cases.sql
├── 006_create_payment_agreements.sql
├── 007_create_interaction_logs.sql
├── 000_rollback_all.sql
└── README.md

seeds/
├── 001_seed_flow_policies.sql
└── README.md
```

## Asociaciones Configuradas

### Tenant (hasMany)
- debtors
- flowPolicies
- importBatches
- debtCases
- paymentAgreements
- interactionLogs

### Debtor (hasMany)
- debtCases
- interactionLogs

### FlowPolicy (hasMany)
- debtCases

### ImportBatch (hasMany)
- debtCases

### DebtCase (hasMany)
- paymentAgreements
- interactionLogs

### BelongsTo
- Debtor → Tenant
- FlowPolicy → Tenant
- ImportBatch → Tenant
- DebtCase → Tenant, Debtor, FlowPolicy, ImportBatch
- PaymentAgreement → Tenant, DebtCase
- InteractionLog → Tenant, DebtCase, Debtor

## Uso

### 1. Ejecutar Migraciones

```bash
# Ejecutar todas las migraciones en orden
for file in migrations/00[1-7]*.sql; do
    psql -U $DB_USER -d $DB_NAME -h $DB_HOST -f "$file"
done
```

### 2. Ejecutar Seeds

```bash
# Crear flow policies por defecto para cada tenant
psql -U $DB_USER -d $DB_NAME -h $DB_HOST -f seeds/001_seed_flow_policies.sql
```

### 3. Usar en el código

Los modelos están disponibles desde `src/models/index.js`:

```javascript
import { Tenant, Debtor, DebtCase, FlowPolicy } from '../models/index.js';

// Usar los modelos
const tenant = await Tenant.create({ name: 'Mi Tenant' });
const debtor = await Debtor.create({
  tenantId: tenant.id,
  fullName: 'Juan Pérez',
  email: 'juan@example.com'
});
```

## Notas Importantes

1. **Multi-tenant**: Siempre filtrar por `tenant_id` en todas las consultas para mantener el aislamiento de datos
2. **JSONB**: Los campos JSONB usan defaults seguros (`{}` o `[]`) tanto en Sequelize como en PostgreSQL
3. **Enums**: Todos los enums están definidos en PostgreSQL como tipos nativos para mejor rendimiento
4. **Índices**: Se han creado índices compuestos para optimizar las consultas más comunes (filtros por tenant_id + otros campos)
5. **Timestamps**: Todas las tablas tienen `created_at` y `updated_at` con trigger automático para `updated_at`

## Próximos Pasos

1. Crear controladores y servicios para cada modelo
2. Implementar endpoints para importación de XLSX
3. Implementar lógica de asignación de flow_policies basada en days_past_due
4. Integrar con proveedores de pago (Stripe) para payment_link_url
5. Integrar con proveedores de comunicación (Twilio, SendGrid) para interaction_logs

