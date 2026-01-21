# Mordecai AI – Core Business Flow (Demo MVP)

Este documento describe el flujo end-to-end del core de Mordecai AI para una demo rápida:
- Reglas de cobranza por edad de cartera
- Carga de cartera (XLSX o ERP)
- Generación de link de pago
- Llamada con IA (conversación + negociación)
- Creación de acuerdo
- Envío del link por email
- Actualización del estado del caso y auditoría (transcript/summary/outcome)

---

## 1) Registro de empresa (Tenant Onboarding)

### Qué ocurre
Una empresa de Property Management crea su cuenta (trial o plan).

### Tablas usadas
- `tenants`

### Operación
Se crea un registro `tenants`:

- `tenants.id` = UUID del tenant
- `name`, `timezone`, `status`, `settings`

> `tenant_id` será la llave de aislamiento para todas las tablas.

---

## 2) Configuración inicial de reglas (Flow Policies)

### Qué ocurre
Para que el usuario no tenga que “armar flujos” desde cero, se crean presets por bucket de mora.

### Tablas usadas
- `flow_policies`

### Operación
Se insertan 3 (o más) `flow_policies` por tenant, por ejemplo:
- 1–5 días (friendly)
- 6–20 días (professional)
- 21+ días (firm)

Cada policy incluye:
- rango: `min_days_past_due`, `max_days_past_due`
- `channels` (JSONB): { sms, email, call, whatsapp }
- `tone`
- `rules` (JSONB) para acuerdos (max cuotas, anticipo mínimo, etc.)

---

## 3) Carga de cartera (XLSX o ERP)

### Opción demo: XLSX

#### 3.1 Se crea el batch
Tabla:
- `import_batches`

Se crea `import_batches`:
- `source = 'XLSX'`
- `file_key` (S3)
- `status = 'PROCESSING'`

#### 3.2 Por cada fila del XLSX
Se crean/actualizan:

**A) Deudor**
Tabla: b
- `debtors`

- Se crea o reutiliza por `email`/`phone` dentro del `tenant_id`.
- Guarda info básica + `metadata` (unit/property/etc).

**B) Caso de cobranza**
Tabla:
- `debt_cases`

Se crea `debt_cases` con:
- `tenant_id`
- `debtor_id`
- `import_batch_id`
- `amount_due_cents`, `days_past_due`, `due_date`
- `status = 'NEW'`

**C) Asignación automática de flow_policy**
Se consulta `flow_policies` por rango de `days_past_due` y se setea:
- `debt_cases.flow_policy_id`

#### 3.3 Se cierra el batch
Tabla:
- `import_batches`

Se actualiza:
- `status = 'COMPLETED'`
- `total_rows`, `success_rows`, `error_rows`, `errors`

---

## 4) Selección de casos a ejecutar (Scheduler/Worker)

### Qué ocurre
Un worker revisa casos pendientes y define la siguiente acción (call/email/sms) según `flow_policy`.

### Tablas usadas
- `debt_cases`
- `flow_policies`

Ejemplo de selección:
- `debt_cases.status IN ('NEW','IN_PROGRESS')`
- `next_action_at <= now()` (si ya existe scheduling)
- `flow_policy.channels.call == true` (si toca llamada)

---

## 5) Inicio de interacción (Llamada IA)

### Qué ocurre
Se dispara una llamada automática al deudor.

### Tablas usadas
- `interaction_logs`
- `debt_cases`
- `debtors`
- `flow_policies`

### Operación
Antes de llamar, se crea un `interaction_logs`:

- type = `CALL`
- status = `queued`
- provider_ref = `callSid` (cuando exista)
- started_at / ended_at (luego)

---

## 6) Conversación IA guiada por reglas

### Qué ocurre
Durante la llamada:
- STT transcribe audio
- LLM recibe contexto del caso + reglas del flow
- LLM responde con:
  - Texto a decir
  - Acciones permitidas (tools): crear acuerdo, enviar email, reprogramar, cerrar caso, etc.

### Tablas usadas (lectura)
- `debt_cases`
- `flow_policies.rules`
- `interaction_logs` (historial si existe)

### Tablas usadas (escritura)
- `interaction_logs` (transcript, summary, outcome)

---

## 7) Creación del acuerdo de pago

### Qué ocurre
Si el deudor acepta pagar:
- Promesa de pago (una fecha)
- O plan de cuotas

### Tablas usadas
- `payment_agreements`
- `debt_cases`

### Operación
Se crea `payment_agreements`:
- `type`: `PROMISE_TO_PAY` o `INSTALLMENTS`
- `status`: `ACCEPTED`
- montos/fechas (`total_amount_cents`, `installments`, `promise_date`, etc.)
- `created_by = 'AI'`
- `terms` (JSONB) con detalles

---

## 8) Generación de link de pago + envío por email

### Qué ocurre
Se genera un link de pago (ej. Stripe) y se envía al deudor.

### Tablas usadas
- `payment_agreements` (o `debt_cases` si manejas link a nivel de caso)
- `interaction_logs`

### Operación
- Se setea `payment_link_url` en `payment_agreements` (recomendado).
- Se registra el envío del email con un `interaction_logs`:
  - type = `EMAIL`
  - status = `sent`
  - provider_ref = messageId (si aplica)
  - outcome = `PAYMENT_PLAN` o `PROMISE_TO_PAY`

---

## 9) Actualización del estado del caso

### Qué ocurre
Se actualiza el caso según lo acordado.

### Tablas usadas
- `debt_cases`

Reglas típicas:
- Si acuerdo cuotas: `debt_cases.status = 'PAYMENT_PLAN'`
- Si promesa: `debt_cases.status = 'PROMISE_TO_PAY'`
- Se actualiza `last_contacted_at = now()`
- Opcional: `next_action_at` si hay seguimiento

---

## 10) Cierre de la llamada y auditoría

### Qué ocurre
Se guarda:
- transcript completo
- resumen IA
- outcome final

### Tablas usadas
- `interaction_logs`

Se actualiza el log de la llamada:
- status = `completed`
- transcript, summary, outcome
- started_at, ended_at

---

## 11) Seguimiento posterior (pago o incumplimiento)

### Caso: paga correctamente
- se marca el acuerdo como completado
- el caso queda pagado y cerrado

Tablas:
- `payment_agreements`
- `debt_cases`

Updates:
- `payment_agreements.status = 'COMPLETED'`
- `debt_cases.status = 'PAID'`
- `debt_cases.closed_at = now()`

### Caso: incumple
Tablas:
- `payment_agreements`
- `debt_cases`

Updates:
- `payment_agreements.status = 'BROKEN'`
- `debt_cases.status = 'IN_PROGRESS'`
- se reprograma `next_action_at`

---

## 12) Relación de entidades (resumen)

Tenant (tenants)
├─ Flow policies (flow_policies)
├─ Import batches (import_batches)
├─ Debtors (debtors)
│  └─ Debt cases (debt_cases)
│     ├─ Payment agreements (payment_agreements)
│     └─ Interaction logs (interaction_logs)
└─ Interaction logs (interaction_logs)

---

