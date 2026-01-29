/**
 * @swagger
 * tags:
 *   name: Tenants
 *   description: >
 *     El módulo **Tenants** administra la creación y configuración inicial de tenants (multi-tenant).
 *     <br/>Cuando se crea un tenant:
 *     <ul>
 *       <li>Se asegura/crea el usuario autenticado en el sistema</li>
 *       <li>Se crea la membresía `TenantUser` con rol <b>owner</b></li>
 *       <li>Se crean <b>Flow Policies</b> por defecto para el tenant</li>
 *     </ul>
 */

/**
 * @swagger
 * /tenants:
 *   post:
 *     summary: Crear tenant
 *     description: Crea un tenant y configura membresía/flow policies por defecto.
 *     tags: [Tenants]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateTenantRequest'
 *           examples:
 *             basic:
 *               value:
 *                 name: "Acme Corp"
 *                 timezone: "America/Bogota"
 *     responses:
 *       201:
 *         description: Tenant creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TenantCreatedResponse'
 *       400:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: No autorizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorUnauthorizedResponse'
 *       403:
 *         description: Prohibido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Conflicto (por ejemplo, si el usuario ya pertenece a un tenant y `ENFORCE_SINGLE_TENANT` está activo)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Error interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     CreateTenantRequest:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *           minLength: 3
 *           example: "Acme Corp"
 *         timezone:
 *           type: string
 *           example: "America/New_York"
 *         settings:
 *           type: object
 *           additionalProperties: true
 *           example: {}
 *
 *     Tenant:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *           example: "Acme Corp"
 *         timezone:
 *           type: string
 *           example: "America/New_York"
 *         status:
 *           type: string
 *           enum: [active, inactive]
 *           example: "active"
 *         settings:
 *           type: object
 *           additionalProperties: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     TenantCreatedResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Tenant created successfully"
 *         data:
 *           $ref: '#/components/schemas/Tenant'
 */

