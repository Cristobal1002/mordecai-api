/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: >
 *     El módulo **Auth** gestiona autenticación, sesión, CSRF y flujos OAuth.
 *     <br/>Incluye:
 *     <ul>
 *       <li>Registro y confirmación</li>
 *       <li>Login / Refresh / Logout</li>
 *       <li>CSRF token (para endpoints sensibles)</li>
 *       <li>OAuth start/callback</li>
 *       <li>Perfil del usuario actual (/me)</li>
 *     </ul>
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Registrar usuario
 *     description: Crea un usuario y dispara flujo de confirmación (según configuración).
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AuthRegisterRequest'
 *           examples:
 *             example:
 *               value:
 *                 email: "user@acme.com"
 *                 password: "StrongPassword123!"
 *                 name: "Cristobal"
 *     responses:
 *       201:
 *         description: Usuario registrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthRegisterResponse'
 *       400:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /auth/confirm:
 *   post:
 *     summary: Confirmar cuenta
 *     description: Confirma una cuenta usando un token/código.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AuthConfirmRequest'
 *     responses:
 *       200:
 *         description: Cuenta confirmada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Iniciar sesión
 *     description: Autentica al usuario y retorna tokens/cookies según implementación.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AuthLoginRequest'
 *     responses:
 *       200:
 *         description: Login exitoso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthLoginResponse'
 *       400:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Renovar sesión (refresh)
 *     description: Renueva tokens. Normalmente requiere CSRF.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AuthRefreshRequest'
 *     responses:
 *       200:
 *         description: Token renovado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthRefreshResponse'
 *       401:
 *         description: No autorizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorUnauthorizedResponse'
 */

/**
 * @swagger
 * /auth/forgot:
 *   post:
 *     summary: Solicitar reset de contraseña
 *     description: Envía instrucciones para resetear contraseña.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AuthForgotRequest'
 *     responses:
 *       200:
 *         description: Solicitud procesada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /auth/reset:
 *   post:
 *     summary: Resetear contraseña
 *     description: Resetea contraseña usando token/código.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AuthResetRequest'
 *     responses:
 *       200:
 *         description: Contraseña actualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /auth/resend-confirm:
 *   post:
 *     summary: Reenviar confirmación
 *     description: Reenvía confirmación de cuenta.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AuthResendConfirmRequest'
 *     responses:
 *       200:
 *         description: Confirmación reenviada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Cerrar sesión
 *     description: Cierra sesión (normalmente requiere CSRF).
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Sesión cerrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: No autorizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorUnauthorizedResponse'
 */

/**
 * @swagger
 * /auth/csrf:
 *   get:
 *     summary: Obtener token CSRF
 *     description: Retorna un token CSRF para llamadas que lo requieren.
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Token CSRF
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CsrfResponse'
 */

/**
 * @swagger
 * /auth/oauth/start:
 *   get:
 *     summary: Iniciar OAuth
 *     description: Inicia el flujo OAuth para un proveedor.
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *           example: Google
 *     responses:
 *       302:
 *         description: Redirección a proveedor OAuth
 *       400:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /auth/oauth/callback:
 *   get:
 *     summary: Callback OAuth
 *     description: Completa el flujo OAuth y retorna sesión/tokens.
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: OAuth completado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthLoginResponse'
 *       400:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Obtener usuario actual
 *     description: Retorna la identidad del usuario autenticado.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Usuario actual
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthMeResponse'
 *       401:
 *         description: No autorizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorUnauthorizedResponse'
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     SuccessResponse:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: "Success operation" }
 *         data: { type: object, nullable: true }
 *
 *     AuthRegisterRequest:
 *       type: object
 *       required: [email, password]
 *       properties:
 *         email: { type: string, format: email, example: "user@acme.com" }
 *         password: { type: string, example: "StrongPassword123!" }
 *         name: { type: string, example: "Cristobal" }
 *
 *     AuthConfirmRequest:
 *       type: object
 *       properties:
 *         token: { type: string, example: "confirm-token" }
 *
 *     AuthLoginRequest:
 *       type: object
 *       required: [email, password]
 *       properties:
 *         email: { type: string, format: email, example: "user@acme.com" }
 *         password: { type: string, example: "StrongPassword123!" }
 *
 *     AuthRefreshRequest:
 *       type: object
 *       properties:
 *         refreshToken: { type: string, example: "refresh-token" }
 *
 *     AuthForgotRequest:
 *       type: object
 *       required: [email]
 *       properties:
 *         email: { type: string, format: email, example: "user@acme.com" }
 *
 *     AuthResetRequest:
 *       type: object
 *       properties:
 *         token: { type: string, example: "reset-token" }
 *         password: { type: string, example: "NewStrongPassword123!" }
 *
 *     AuthResendConfirmRequest:
 *       type: object
 *       required: [email]
 *       properties:
 *         email: { type: string, format: email, example: "user@acme.com" }
 *
 *     AuthTokens:
 *       type: object
 *       properties:
 *         accessToken: { type: string, example: "eyJ..." }
 *         refreshToken: { type: string, example: "eyJ..." }
 *
 *     AuthRegisterResponse:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: "User registered" }
 *         data:
 *           type: object
 *           properties:
 *             user:
 *               type: object
 *               properties:
 *                 id: { type: string, format: uuid }
 *                 email: { type: string, format: email }
 *
 *     AuthLoginResponse:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: "Login successful" }
 *         data:
 *           type: object
 *           properties:
 *             user:
 *               type: object
 *               properties:
 *                 id: { type: string, format: uuid }
 *                 email: { type: string, format: email }
 *             tokens:
 *               $ref: '#/components/schemas/AuthTokens'
 *
 *     AuthRefreshResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/AuthLoginResponse'
 *
 *     AuthMeResponse:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: "Authenticated" }
 *         data:
 *           type: object
 *           properties:
 *             sub: { type: string, example: "auth0|abc" }
 *             email: { type: string, format: email, example: "user@acme.com" }
 *
 *     CsrfResponse:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: "Success operation" }
 *         data:
 *           type: object
 *           properties:
 *             csrfToken: { type: string, example: "csrf-token" }
 */

