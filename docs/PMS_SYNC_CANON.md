# PMS Sync: Modelos canónicos y uso en integraciones

Este documento describe los modelos que agregamos para la primera sincronización (MVP de cobranza), el **canon** (formato estándar) que debe devolver cada integración, y cómo usarlo con Rentvine, Buildium o cualquier PMS nuevo.

### Mejoras recientes

- **external_mappings**: clave única por `(pms_connection_id, entity_type, external_id)`. El runner lo usa como **caché** para resolver `leaseExternalId` → `pms_lease_id` (y debtor, property, unit) sin consultar siempre la tabla principal; soporta aliases y merges futuros.
- **sync_state** en `pms_connections` (JSONB): cursores por entidad (`debtorsSince`, `leasesSince`, `chargesSince`, `paymentsSince`) y timestamps (`lastAttemptAt`, `lastSuccessfulRunAt`) para sync incremental y reintentos por pasos.
- **Canon para cobranza**: en charges, `openAmountCents` (saldo pendiente si el PMS lo da); en leases, `isActive`/`occupancyStatus` y opcionales `propertyExternalId`/`unitExternalId`; el runner persiste `open_amount_cents` y resuelve property/unit.
- **applied_to_charges**: se guarda en JSONB; para auditoría o aging fino más adelante se puede añadir tabla normalizada `ar_payment_applications` (payment_id, charge_id, amount_cents).
- **ArBalance**: diseño **snapshot** (una fila por lease + as_of_date); “saldo actual” = fila con fecha más reciente.
- **SyncRun**: `trigger` (manual | scheduled | webhook), `idempotency_key`; **un solo sync activo** por conexión (bloqueo en API + índice único parcial en BD).
- **Reglas operativas** (§6): idempotencia por entidad, soft delete, moneda/redondeo, resolución de relaciones tolerante (`missingRelations`), modo incremental futuro, y regla única para cálculo de balances/aging.

---

## 1. Modelos nuevos (tablas canónicas)

Todos viven bajo una **conexión PMS** (`pms_connection_id`) y un **tenant**. La clave de deduplicación es siempre `(pms_connection_id, external_id)` por entidad.

### A) Identidad y deduplicación

| Modelo | Tabla | Propósito |
|--------|--------|------------|
| **ExternalMapping** | `external_mappings` | Mapea `externalId` del PMS → `internalId` nuestro. Clave única por `(pms_connection_id, entity_type, external_id)`. Caché para resolver relaciones (lease, debtor, property, unit) en el runner; soporta aliases y merges. |
| **PmsConnection** | `pms_connections` | Incluye **sync_state** (JSONB): `lastAttemptAt`, `lastSuccessfulRunAt`, y opcionales `debtorsSince`, `leasesSince`, `chargesSince`, `paymentsSince` para sync incremental. Opcional: `default_currency` (p. ej. `'USD'`) cuando el PMS no envía moneda (ver §6.3). |

### B) Deudores y contacto

| Modelo | Tabla | Propósito |
|--------|--------|------------|
| **PmsDebtor** | `pms_debtors` | Persona o empresa que debe. Campos: `external_id`, `display_name`, `type` (person/company), `email`, `phone`, `address` (JSONB), `language`, `timezone`, `do_not_contact`, `do_not_call`, `meta`, `last_external_updated_at`. Opcional: `is_active` o `deleted_at` para soft delete (ver §6.2). |
| **PmsDebtorContact** | `pms_debtor_contacts` | Teléfonos, emails, direcciones por deudor. Campos: `pms_debtor_id`, `contact_type` (email/phone/postal), `value`, `label`, `is_primary`, `external_id`. |

### C) Contexto (propiedad / unidad / contrato)

| Modelo | Tabla | Propósito |
|--------|--------|------------|
| **PmsProperty** | `pms_properties` | Propiedad o comunidad (opcional). `external_id`, `name`, `address` (JSONB). |
| **PmsUnit** | `pms_units` | Unidad (apto/casa) (opcional). `external_id`, `unit_number`, `pms_property_id`. |
| **PmsLease** | `pms_leases` | Contrato/lease. Vincula deudor y opcionalmente propiedad/unidad. Campos: `external_id`, `pms_debtor_id`, `lease_number`, `status` (active/ended/pending), `move_in_date`, `move_out_date`, `last_note_summary`, `in_collections`, `last_external_updated_at`. Opcional: `is_active` o `deleted_at` para soft delete (ver §6.2). |

### D) Cartera (ledger)

| Modelo | Tabla | Propósito |
|--------|--------|------------|
| **ArCharge** | `ar_charges` | Cargos/facturas. Por lease. Campos: `external_id`, `pms_lease_id`, `charge_type`, `amount_cents`, `open_amount_cents` (saldo pendiente si el PMS lo da), `currency`, `due_date`, `post_date`, `description`. |
| **ArPayment** | `ar_payments` | Pagos aplicados. Campos: `external_id`, `pms_lease_id` (opcional), `amount_cents`, `paid_at`, `payment_method`, `applied_to_charges` (JSONB: `[{ chargeId, amountCents }]`). Para auditoría fina o aging preciso más adelante se puede añadir tabla normalizada `ar_payment_applications` (payment_id, charge_id, amount_cents). |
| **ArAdjustment** | `ar_adjustments` | Créditos/ajustes. `external_id`, `pms_lease_id`, `adjustment_type`, `amount_cents`, `applied_at`, `description`. |

### E) Saldos y reporting

| Modelo | Tabla | Propósito |
|--------|--------|------------|
| **ArBalance** | `ar_balances` | Saldo consolidado por lease y fecha. `pms_lease_id`, `balance_cents`, `currency`, `as_of_date`. Una fila por (lease, as_of_date) — diseño **snapshot**: para “saldo actual” usar la fila con la fecha más reciente; para histórico se puede añadir después `ar_balance_snapshots` si se necesita. |
| **ArAgingSnapshot** | `ar_aging_snapshots` | Snapshot de aging por conexión y fecha. `as_of_date`, `total_cents`, `bucket_0_30_cents`, `bucket_31_60_cents`, `bucket_61_90_cents`, `bucket_90_plus_cents`, `currency`. |
| **SyncRun** | `sync_runs` | Historial de cada ejecución de sync. `status`, `trigger` (manual \| scheduled \| webhook), `idempotency_key`, `triggered_at`, `started_at`, `finished_at`, `step`, `stats` (p. ej. `missingRelations`: ver §6.4), `error_message`, `error_details`. Solo un sync activo (pending/running) por conexión. |

---

## 2. Orden canónico (dependencias)

El sync runner **siempre** procesa en este orden porque las entidades se referencian entre sí:

1. **Debtors** (y opcionalmente contacts) → sin dependencias de otras entidades nuestro.
2. **Leases** → requieren `pms_debtor_id`; usan `debtorExternalId` en el payload para resolver.
3. **Charges** → requieren `pms_lease_id`; usan `leaseExternalId` en el payload.
4. **Payments** → opcionalmente `pms_lease_id`; usan `leaseExternalId` en el payload.
5. **Balances + aging** → se calculan en nuestro lado a partir de charges y payments ya guardados.

Por eso el contrato del connector es: devolver **listas planas** con **claves externas** (`debtorExternalId`, `leaseExternalId`). El runner hace el upsert y resuelve esas claves a nuestros UUID internos.

---

## 3. Formato canónico: qué debe devolver `syncFull()`

Cada connector (Rentvine, Buildium, etc.) implementa `syncFull()` y debe devolver un **único objeto** con esta forma. Así todas las integraciones hablan el mismo idioma y el runner no sabe si los datos vienen de Rentvine o de Buildium.

```js
{
  debtors: [
    {
      externalId: string,           // ID en el PMS (ej. "res-123")
      displayName: string,
      type?: 'person' | 'company',
      email?: string,
      phone?: string,
      address?: object,
      language?: string,
      timezone?: string,
      doNotContact?: boolean,
      doNotCall?: boolean,
      meta?: object,
      lastExternalUpdatedAt?: string (ISO date),
    }
  ],
  leases: [
    {
      externalId: string,
      debtorExternalId: string,     // mismo externalId que en debtors[]
      leaseNumber?: string,
      status?: 'active' | 'ended' | 'pending',
      isActive?: boolean,           // ocupación activa (priorizar cobranza)
      occupancyStatus?: string,     // alternativo a isActive si el PMS lo expone
      propertyExternalId?: string,  // opcional, para vincular pms_property_id
      unitExternalId?: string,     // opcional, para vincular pms_unit_id
      moveInDate?: string (YYYY-MM-DD),
      moveOutDate?: string,
      lastNoteSummary?: string,
      inCollections?: boolean,
      lastExternalUpdatedAt?: string,
    }
  ],
  charges: [
    {
      externalId: string,
      leaseExternalId: string,      // mismo externalId que en leases[]
      chargeType?: string,
      amountCents: number,
      openAmountCents?: number,     // saldo pendiente del cargo si el PMS lo da (evita recalcular)
      currency?: string,
      dueDate: string (YYYY-MM-DD),
      postDate?: string,
      description?: string,
      lastExternalUpdatedAt?: string,
    }
  ],
  payments: [
    {
      externalId: string,
      leaseExternalId?: string,
      amountCents: number,
      currency?: string,
      paidAt: string (ISO datetime),
      paymentMethod?: string,
      appliedToCharges?: Array<{ chargeId?: string, amountCents?: number }>,
      lastExternalUpdatedAt?: string,
    }
  ],
  stats?: object   // opcional: métricas propias del connector
}
```

- **externalId**: siempre el ID que usa el PMS para esa entidad (resident id, lease id, charge id, payment id).
- **debtorExternalId** en leases: debe coincidir con `debtors[].externalId`.
- **leaseExternalId** en charges/payments: debe coincidir con `leases[].externalId`.
- **openAmountCents** en charges: si el PMS expone saldo pendiente por cargo, enviarlo para evitar recalcular con aplicaciones.
- **propertyExternalId** / **unitExternalId** en leases: opcionales; el runner resuelve a `pms_property_id` / `pms_unit_id` vía `external_mappings` o tablas canónicas.
- **Moneda**: si el PMS no envía `currency` por cargo/pago, el runner usará la moneda por defecto de la conexión (ver §6.3). Los montos siempre en centavos (enteros).

El runner hace upsert por `(pms_connection_id, external_id)` (§6.1) y usa **external_mappings** como caché para resolver relaciones (§6.4): si no hay mapping, lookup en tabla principal y si existe se crea el mapping; si no existe, se registra en `stats.missingRelations` y se continúa sin tumbar el sync.

---

## 4. Cómo usar el canon en cada integración

### Patrón: API del PMS → Mapper → canon

En cada connector (p. ej. `rentvine/` o `buildium/`) conviene tener:

1. **Cliente** (`*.client.js`): llama a la API del PMS (GET residents, GET leases, etc.).
2. **Mapper** (`*.mapper.js`): convierte la respuesta cruda del PMS al **formato canónico** (los objetos de `debtors`, `leases`, `charges`, `payments` de arriba).
3. **Connector** (`*.connector.js`): en `syncFull()` usa el cliente para traer datos, el mapper para normalizarlos, y devuelve `{ debtors, leases, charges, payments, stats }`.

Así:

- El **runner** solo conoce el canon; no sabe nada de Rentvine ni Buildium.
- **Rentvine** puede devolver residentes con `id`, `firstName`, `lastName`, `email`, etc.; el mapper los convierte a `{ externalId, displayName, email, ... }`.
- **Buildium** puede tener otro esquema; su mapper convierte al mismo canon.
- Una **tercera integración** solo tiene que implementar cliente + mapper + connector y devolver el mismo objeto; el resto del pipeline (upsert, balances, aging, sync_runs) ya está resuelto.

### Ejemplo mínimo de mapper (Rentvine)

```js
// rentvine.mapper.js
export function mapResidentToCanonicalDebtor(resident) {
  return {
    externalId: String(resident.id),
    displayName: [resident.firstName, resident.lastName].filter(Boolean).join(' ') || 'Unknown',
    type: 'person',
    email: resident.email ?? null,
    phone: resident.phone ?? null,
    address: resident.address ?? {},
    lastExternalUpdatedAt: resident.updatedAt ?? null,
  };
}

export function mapLeaseToCanonical(lease, residentExternalId) {
  return {
    externalId: String(lease.id),
    debtorExternalId: String(residentExternalId),
    leaseNumber: lease.leaseNumber ?? null,
    status: lease.status === 'Current' ? 'active' : 'ended',
    moveInDate: lease.moveInDate ?? null,
    moveOutDate: lease.moveOutDate ?? null,
    lastExternalUpdatedAt: lease.updatedAt ?? null,
  };
}
```

El connector en `syncFull()` haría algo como:

```js
const residents = await client.getResidents();
const debtors = residents.map(mapResidentToCanonicalDebtor);
const leasesRaw = await client.getLeases();
const leases = leasesRaw.map(l => mapLeaseToCanonical(l, l.residentId));
// similar para charges y payments desde la API del PMS
return { debtors, leases, charges, payments, stats: {} };
```

### Contactos (pms_debtor_contacts)

El canon actual del runner **no** pide un array `contacts` en el payload: los contactos se podrían derivar de `debtors[].email` y `debtors[].phone`. Si un PMS expone varios emails/teléfonos por residente, tienes dos opciones:

- **Opción A**: En el mapper, dejar un solo email/teléfono en el debtor y el resto meterlos en una estructura que el runner no persiste aún (p. ej. `debtor.contacts: [{ contactType, value, label }]`) y más adelante el runner puede escribir en `pms_debtor_contacts` si se añade ese paso.
- **Opción B**: Extender el canon y el runner para aceptar algo como `debtors[].contacts` y hacer upsert de `PmsDebtorContact` en el paso 1 (igual que hoy con debtors y leases).

Mientras tanto, el modelo **PmsDebtorContact** existe y está asociado a **PmsDebtor**; solo falta que el runner (y opcionalmente el canon) soporten un array de contactos por debtor si lo necesitas.

---

## 5. Control incremental y estado de sync

En **pms_connections** el campo **sync_state** (JSONB) guarda el cursor de sync por entidad para futuros sync incrementales:

- `lastAttemptAt`, `lastSuccessfulRunAt`: timestamps del último intento y último éxito.
- `debtorsSince`, `leasesSince`, `chargesSince`, `paymentsSince`: cursores que el connector puede devolver en `stats.cursors` al terminar un sync; el runner los persiste aquí.

Así se puede implementar “traer solo lo nuevo” por entidad y reintentos por pasos sin recalcular todo.

**SyncRun** incluye `trigger` (manual | scheduled | webhook) e `idempotency_key`; solo se permite un sync activo (pending/running) por conexión (índice único parcial en BD). Si la conexión está en `syncing`, la API rechaza un nuevo sync manual.

---

## 6. Reglas operativas

Estas reglas hacen que el sync aguante **volumen real**, **reintentos** y **datos sucios o desordenados** del PMS. Se documentan aquí para implementación actual o futura.

### 6.1 Idempotencia por entidad

- El runner hace **upsert** por `(pms_connection_id, external_id)` en cada tabla canónica (debtors, leases, charges, payments, etc.).
- Si la misma entidad llega dos veces (p. ej. por reintento o datos fuera de orden):
  - **Cuando exista `lastExternalUpdatedAt`** en el canon: actualizar el registro solo si el `lastExternalUpdatedAt` entrante es **mayor** que el ya guardado; si es menor o igual, no sobrescribir (evita regresiones).
  - **Cuando la entidad no tenga ese campo**: actualizar siempre y dejar `updated_at` como registro de la última escritura.

Así se evitan regresiones cuando el PMS entrega datos fuera de orden o duplicados.

### 6.2 Soft delete / desactivación

En un sync full puede pasar que un lease o debtor “desaparezca” del payload (migraciones, filtros, permisos del PMS).

- **Recomendación**: añadir en las tablas canónicas afectadas (p. ej. `pms_debtors`, `pms_leases`) un campo de desactivación:
  - `is_active` (boolean, default true), o
  - `deleted_at` (timestamp nullable; null = activo).
- **Reglas**:
  - **Sync full**: opcionalmente, al finalizar el paso de debtors/leases, marcar como inactivos los registros cuyo `external_id` **no** vino en el payload actual. Solo aplicar esta regla si el PMS es confiable (p. ej. la API devuelve “todo lo que existe”).
  - **Sync incremental**: no inactivar nada automáticamente; solo actualizar lo que sí vino. Los que dejaron de llegar quedan como están hasta un full sync que los excluya.

Implementación: definir el campo en migración y en el runner aplicar la lógica cuando corresponda.

### 6.3 Moneda y redondeo (cobranza)

La cobranza sufre con inconsistencias de moneda y redondeo. Reglas a respetar:

- **amountCents** (y `openAmountCents`, `balance_cents`, etc.): siempre **entero**; nunca decimales en centavos.
- **currency**: obligatorio por conexión. Si el PMS no lo envía por cargo/pago, usar un **default por conexión** guardado en `pms_connections` (p. ej. `default_currency`, default `'USD'`).
- **Conversión / redondeo**: si en algún momento se convierte de otra unidad a centavos, usar **redondeo estándar** (p. ej. half away from zero / “round half up”). Documentar en código qué regla se usa para auditoría.

### 6.4 Resolución de relaciones con external_mappings

El runner usa **external_mappings** como caché. Comportamiento obligatorio para ser tolerante a datos incompletos:

1. Resolver p. ej. `leaseExternalId` → `pms_lease_id`:
   - Buscar primero en **external_mappings** por `(pms_connection_id, entity_type: 'lease', external_id)`.
2. Si **no** hay fila en mappings:
   - Hacer **lookup en la tabla principal** (`pms_leases`) por `(pms_connection_id, external_id)`.
   - Si se encuentra: **crear la fila en external_mappings** (para próximas veces) y usar ese `id` como `pms_lease_id`.
   - Si **no** se encuentra: **no fallar el sync**. Registrar en `sync_runs.stats.missingRelations` (p. ej. `{ leases: ['externalId1', 'externalId2'] }`) y continuar; el charge o payment queda sin ese lease o se omite según la regla de negocio.

Así el sistema tolera payloads con referencias a entidades que aún no existen o que fallaron en un paso anterior.

### 6.5 Modo incremental del canon (futuro cercano)

Además de `syncFull()`, cada connector puede soportar en el futuro:

- **`syncIncremental({ since })`**: el runner pasa el `since` por entidad (desde `sync_state`: `debtorsSince`, `leasesSince`, etc.). El connector devuelve solo lo creado/actualizado desde ese cursor.
- En **`stats.cursors`** el connector puede devolver **`nextSince`** por entidad (el cursor “comprobado” hasta donde hay datos). El runner actualiza `sync_state` con esos valores para el próximo incremental.

Así los cursores en `sync_state` quedan validados por lo que el connector realmente procesó.

### 6.6 Cálculo de balances y aging: regla única

Para evitar discusiones y variaciones entre integraciones:

- **Aging**: se calcula siempre por **dueDate** (fecha de vencimiento del cargo), **no** por postDate.
- **Buckets**: 0–30, 31–60, 61–90, 90+ días, calculados como `asOfDate - dueDate` (días de atraso). Límites: (0, 30], (30, 60], (60, 90], > 90.
- **Saldo por cargo** para aging/balances:
  - Si el cargo tiene **openAmountCents** (del PMS o ya persistido): usarlo como saldo pendiente.
  - Si no: calcular con **aplicaciones** (restar de `amount_cents` la suma aplicada desde `applied_to_charges` o desde la futura tabla `ar_payment_applications`), o bien `amount_cents - sum(applied)` por charge.

Una sola regla en todo el sistema para reportes y cola de cobranza.

---

## 7. Resumen

| Qué | Dónde |
|-----|--------|
| Modelos y tablas canónicas | `src/models/` (pms-debtor, pms-lease, ar-charge, ar-payment, etc.) |
| Orden y lógica de sync | `src/modules/property-managers/sync/sync-runner.service.js` (4 pasos) |
| Contrato de datos (canon) | Objeto `{ debtors, leases, charges, payments, stats }` con `externalId` y `*ExternalId` para relaciones |
| Por integración | Cliente (API del PMS) + Mapper (a canon) + Connector (`syncFull()` que devuelve ese objeto) |

Usando este canon, cualquier integración nueva solo tiene que mapear su API al mismo formato; el orden canónico y el resto del flujo (upsert, balances, aging, sync_runs) se reutilizan sin cambiar el runner.
