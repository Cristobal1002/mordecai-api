# Plantillas de correo

El backend usa plantillas HTML para los correos transaccionales. Ubicación: `src/email-templates/`.

## 1. Invitación a usuarios del equipo

**Cuándo:** Al invitar un nuevo miembro al tenant (`POST /api/v1/tenants/:tenantId/members`).

**Plantilla:** `team-invitation.js`

**Variables:**
- `inviteeEmail` – Email del invitado
- `inviterName` – Nombre de quien invita
- `tenantName` – Nombre del tenant/empresa
- `acceptUrl` – URL completa para aceptar (ej. `https://app.mordecai.ai/invitations/TOKEN`)
- `expiresInDays` – Días de validez del enlace (default: 7)

**Env:** `FRONTEND_APP_URL` – URL base del frontend para construir `acceptUrl`. Si no está definida, se usa `COGNITO_FRONTEND_REDIRECT_URI` (sin `/auth/callback`) o `https://app.mordecai.ai`.

---

## 2. Recuperación de credenciales

**Cuándo:** El usuario solicita reset de contraseña.

**Nota:** Hoy el flujo usa **AWS Cognito** para el reset. El correo lo envía Cognito, no nuestro backend.

**Configuración en Cognito:**
1. AWS Console → Cognito → User Pool → Message customizations
2. En "Forgot password" usa placeholders: `{####}` = código, `{username}` = email

**Plantilla de referencia:** `password-recovery.js` – sirve como referencia o para un flujo custom futuro.

**Variables (para flujo custom):**
- `email` – Email del usuario
- `code` – Código de verificación (entrada manual)
- `resetUrl` – Enlace directo de reset (alternativa a `code`)
- `companyName` – Nombre de la app/empresa
- `expiresInMinutes` – Validez del código/enlace

---

## 3. OTP de verificación (deudores)

**Cuándo:** Cuando un deudor solicita verificación para acceder al pay link o ver detalles de su cuenta.

**Plantilla:** `otp-verification.js`

**Variables:**
- `code` – Código OTP de 6 dígitos
- `companyName` – Nombre del tenant/empresa (branding)
- `expiresInMinutes` – Minutos de validez (default: 15)

**Uso:** `sendOtpEmail(to, code, companyName)`

---

## 4. Notificaciones de cartera

**Cuándo:** Envío de correos a deudores en automations/colecciones.

**Plantilla:** `collections-notification.js`

**Variables:**
- `debtorName` – Nombre del residente
- `companyName` – Nombre del tenant/propietario
- `amountDue` – Monto pendiente (string)
- `currency` – Moneda (ej. USD)
- `daysPastDue` – Días de atraso
- `dueDate` – Fecha de vencimiento
- `paymentUrl` – Enlace para ver/pagar (opcional)
- `message` – Mensaje adicional (opcional)
- `stage` – `'early'` | `'mid'` | `'late'` para el tono del mensaje

**Uso con TenantMessageTemplate:**  
Los templates por tenant (`tenant_message_templates`) permiten personalizar el asunto y el cuerpo. `renderCollectionsNotification` sirve como base/default cuando no hay template de tenant.

---

## Preview de plantillas

Para ver cómo quedan los correos en el navegador:

```bash
node scripts/preview-email-templates.js
open email-preview/otp-verification.html
```

Se generan archivos en `email-preview/` con datos de ejemplo.

---

## Servicio de email

Ubicación: `src/services/email.service.js`

Funciones exportadas:
- `sendOtpEmail(to, code, companyName)` – OTP para verificación pay links
- `sendInvitationEmail({ to, inviterName, tenantName, acceptUrl, expiresInDays })`
- `sendPasswordRecoveryEmail({ to, code, resetUrl, companyName, expiresInMinutes })` – flujo custom
- `sendCollectionsNotificationEmail({ to, ...vars })` – notificaciones de cartera
- `sendTemplatedEmail({ to, subject, html, replyTo })` – envío genérico

## Requisitos

- AWS SES configurado (`AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
- `SES_FROM_EMAIL` o `OTP_FROM_EMAIL` para el remitente
- Dominio verificado en SES para el remitente
