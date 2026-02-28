# Case Approval & Disputes — Evaluación y Plan

Evaluación del feedback de clientes y plan de implementación para aprobación de cases y disputas.

---

## Evaluación general

El diseño propuesto es sólido y encaja bien con la arquitectura actual. Recomendamos implementarlo por fases.

### Qué está bien planteado

1. **Approval mode por automation** — Separa gobernanza (approval) de operación (status). No rompe flujos existentes.
2. **approval_status separado de status** — Correcto. `status` ya tiene NEW, IN_PROGRESS, etc. Añadir `approval_status` evita conflictos.
3. **Guard en tick + worker** — El filtro antes de ejecutar es el enfoque correcto.
4. **Disputes como "case hold"** — Claramente definido: pausa automatización, trazabilidad, puede resolverse.
5. **Tabs: Pending / Active / Excluded / Disputes** — UX clara.
6. **Reasons predefinidas** — Facilita reportes y métricas.

### Sugerencias y refinamientos

| Punto | Sugerencia |
|-------|------------|
| **HYBRID rules** | MVP: empezar con reglas simples (DPD ≤ X, amount ≤ Y). "Stage = Special" y "missing phone/email" son buena segunda iteración. |
| **approval_status en debt_case** | Sí, en `debt_cases`. Un case aprobado está aprobado globalmente. Si el case se mueve entre automations, ya está aprobado. |
| **is_excluded** | Mejor como `approval_status = 'EXCLUDED'` que campo booleano. Un solo campo con sentido semántico claro. |
| **Endpoints bulk** | Los endpoints por automation (`/automations/:id/cases/bulk-approve`) tienen sentido porque el tab "Pending" es por automation. Pero un case puede estar en un solo automation a la vez (CaseAutomationState), así que el scope está claro. |
| **Evidence URLs** | Para MVP: `evidence_urls` como JSONB array de strings (URLs S3). Sin upload directo en fase 1; se puede añadir después. |
| **Auto-dispute triggers** | Muy buenos para v2. "I already paid" vía IA/transcripción y "pago detectado en PMS" son diferenciales fuertes. |

### Decisiones de diseño

1. **approval_status** en `debt_cases`: `PENDING_APPROVAL` | `APPROVED` | `REJECTED` | `EXCLUDED`
2. **Default `APPROVED`** para tenants existentes (no romper flujo actual).
3. **Tab "Active"** = cases con `approval_status = APPROVED`, `case_automation_state.status = 'active'`, sin disputa abierta.
4. **Tab "Pending approval"** = cases con `approval_status = PENDING_APPROVAL` en esa automation.
5. **Disputes** = tabla `case_disputes` vinculada a `debt_case_id`. Un case puede tener varias disputas en el tiempo, pero solo una OPEN a la vez.

---

## Modelo de datos

### debt_cases (nuevos campos)

```sql
ALTER TABLE debt_cases ADD COLUMN approval_status VARCHAR(32) DEFAULT 'APPROVED'
  CHECK (approval_status IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'EXCLUDED'));
CREATE INDEX idx_debt_cases_approval_status ON debt_cases(tenant_id, approval_status);
```

### collection_automations (nuevos campos)

```sql
ALTER TABLE collection_automations ADD COLUMN approval_mode VARCHAR(32) DEFAULT 'AUTO'
  CHECK (approval_mode IN ('AUTO', 'REQUIRE_APPROVAL', 'HYBRID'));
ALTER TABLE collection_automations ADD COLUMN approval_rules JSONB DEFAULT '{}';
-- approval_rules: { "autoApproveMaxDpd": 30, "autoApproveMaxAmountCents": 50000, "requireApprovalStages": ["special"], "requireApprovalMissingContact": true }
```

### case_disputes (tabla nueva)

```sql
CREATE TYPE case_dispute_status AS ENUM ('OPEN', 'WAITING_TENANT', 'WAITING_DEBTOR', 'RESOLVED', 'CLOSED');
CREATE TYPE case_dispute_reason AS ENUM (
  'PAID_ALREADY', 'WRONG_AMOUNT', 'WRONG_DEBTOR', 'LEASE_ENDED',
  'UNDER_LEGAL_REVIEW', 'PROMISE_OFFLINE', 'DO_NOT_CONTACT', 'OTHER'
);

CREATE TABLE case_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_case_id UUID NOT NULL REFERENCES debt_cases(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  status case_dispute_status NOT NULL DEFAULT 'OPEN',
  reason case_dispute_reason NOT NULL,
  notes TEXT,
  evidence_urls JSONB DEFAULT '[]',
  opened_by UUID REFERENCES users(id),
  opened_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_case_disputes_debt_case ON case_disputes(debt_case_id);
CREATE INDEX idx_case_disputes_tenant_status ON case_disputes(tenant_id, status);
CREATE UNIQUE INDEX idx_case_disputes_one_open_per_case ON case_disputes(debt_case_id) WHERE status = 'OPEN';
```

---

## Integración con enroll

Al enrolar un case en una automation:

- **AUTO**: `approval_status = 'APPROVED'`
- **REQUIRE_APPROVAL**: `approval_status = 'PENDING_APPROVAL'`
- **HYBRID**: evaluar reglas; si cumple auto-approve → `APPROVED`, si no → `PENDING_APPROVAL`

---

## Guards (collection-tick + worker)

### collection-tick.service.js

En el loop de `dueStates`, antes de procesar:

```js
// Skip if approval not granted
if (state.debtCase.approvalStatus !== 'APPROVED') continue;

// Skip if case has open dispute
const hasOpenDispute = await hasOpenDisputeForCase(state.debtCaseId);
if (hasOpenDispute) continue;
```

### Worker (processCallCase, processSmsCase, processEmailCase)

Al inicio de cada procesador:

```js
if (debtCase.approvalStatus !== 'APPROVED') {
  return { caseId, logId, skipped: true, reason: 'approval_required' };
}
const hasOpenDispute = await hasOpenDisputeForCase(caseId);
if (hasOpenDispute) {
  return { caseId, logId, skipped: true, reason: 'open_dispute' };
}
```

---

## Checklist de implementación

### Fase 1: Backend — Migraciones y modelo

- [ ] Migración: `debt_cases.approval_status` (default APPROVED)
- [ ] Migración: `collection_automations.approval_mode`, `approval_rules`
- [ ] Migración: tabla `case_disputes`
- [ ] Modelos: DebtCase + approvalStatus, CollectionAutomation + approvalMode/approvalRules
- [ ] Modelo: CaseDispute
- [ ] Helper: `hasOpenDisputeForCase(debtCaseId)`
- [ ] Helper: `resolveApprovalStatus(case, automation)` para HYBRID

### Fase 2: Backend — Endpoints

- [ ] `GET /automations/:id/cases?tab=pending|active|excluded|disputes`
- [ ] `POST /automations/:id/cases/bulk-approve` (body: `{ caseIds: string[] }`)
- [ ] `POST /automations/:id/cases/bulk-reject`
- [ ] `POST /automations/:id/cases/bulk-exclude`
- [ ] `POST /cases/:id/disputes` (body: reason, notes)
- [ ] `POST /disputes/:id/resolve` (body: resolution)
- [ ] `PATCH /automations/:id` — approval_mode, approval_rules (Settings)

### Fase 3: Backend — Guards y enroll

- [ ] enroll: set approval_status según automation approval_mode
- [ ] collection-tick: skip si approval_status !== APPROVED o has open dispute
- [ ] Worker: skip en processCallCase, processSmsCase, processEmailCase
- [ ] case.service: pause → opción "Move to dispute"

### Fase 4: Frontend — Cases con tabs

- [ ] Tabs: Pending approval | Active | Excluded | Disputes
- [ ] Tab Pending: tabla + checkbox + Approve / Reject / Exclude (bulk)
- [ ] Tab Active: tabla actual + "Mark as dispute" + "Pause case"
- [ ] Tab Excluded: lista de excluded
- [ ] Tab Disputes: tabla con debtor, amount, reason, status, opened_by, acciones
- [ ] Modal "Open dispute" (reason dropdown, notes)
- [ ] Modal "Resolve dispute" (resolution text)

### Fase 5: Frontend — Automation Settings

- [ ] Settings: Approval mode (AUTO | REQUIRE_APPROVAL | HYBRID)
- [ ] Si HYBRID: formulario reglas (autoApproveMaxDpd, autoApproveMaxAmountCents, etc.)

### Fase 6 (opcional)

- [ ] Export CSV desde tab Pending
- [ ] Audit log (approved/rejected/excluded, dispute opened/resolved)
- [ ] Auto-dispute: "I already paid" en transcripción
- [ ] Auto-dispute: pago detectado en PMS post-sync

---

## Orden recomendado de implementación

1. **Migraciones + modelos** — Base de datos lista
2. **Guards en tick + worker** — Nada se rompe (default APPROVED)
3. **enroll con approval_status** — Nuevos cases siguen las reglas
4. **Settings en automation** — approval_mode, approval_rules
5. **Endpoints bulk + disputes** — API lista
6. **Frontend tabs y modales** — UX completa

---

## Notas

- La constraint `idx_case_disputes_one_open_per_case` evita múltiples disputas OPEN por case.
- `opened_by` y `resolved_by` usan `users(id)` si existe; si no, puede ser NULL o un campo de texto.
- Para "Pause case" en Active: ya existe `case.service.pause` que pone `case_automation_state.status = 'paused'`. "Move to dispute" es distinto: crea disputa y puede pausar.
