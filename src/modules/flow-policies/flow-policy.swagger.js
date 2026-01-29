/**
 * @swagger
 * tags:
 *   name: FlowPolicies
 *   description: >
 *     El módulo **FlowPolicies** administra políticas de contacto por tenant
 *     (canales, tonos, reglas y rangos de días de mora).
 */

/**
 * @swagger
 * /tenants/{tenantId}/flow-policies:
 *   get:
 *     summary: Listar flow policies
 *     tags: [FlowPolicies]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Lista de flow policies
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FlowPolicyListResponse'
 *       400:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 *   post:
 *     summary: Crear flow policy
 *     tags: [FlowPolicies]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateFlowPolicyRequest'
 *     responses:
 *       201:
 *         description: Flow policy creada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FlowPolicyCreatedResponse'
 *       400:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     FlowPolicy:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         tenantId: { type: string, format: uuid }
 *         name: { type: string, example: "Mid Stage (6-20 days)" }
 *         minDaysPastDue: { type: integer, example: 6 }
 *         maxDaysPastDue: { type: integer, nullable: true, example: 20 }
 *         channels:
 *           type: object
 *           properties:
 *             sms: { type: boolean, example: true }
 *             email: { type: boolean, example: true }
 *             call: { type: boolean, example: true }
 *             whatsapp: { type: boolean, example: false }
 *         tone: { type: string, example: "professional" }
 *         rules: { type: object, additionalProperties: true }
 *         isActive: { type: boolean, example: true }
 *
 *     CreateFlowPolicyRequest:
 *       type: object
 *       required: [name, minDaysPastDue]
 *       properties:
 *         name: { type: string, example: "Custom Stage" }
 *         minDaysPastDue: { type: integer, example: 1 }
 *         maxDaysPastDue: { type: integer, nullable: true, example: 10 }
 *         channels:
 *           type: object
 *           example: { sms: true, email: true, call: false, whatsapp: false }
 *         tone: { type: string, example: "friendly" }
 *         rules: { type: object, example: { max_promise_days: 7 } }
 *         isActive: { type: boolean, example: true }
 *
 *     FlowPolicyListResponse:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: "Success operation" }
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/FlowPolicy'
 *
 *     FlowPolicyCreatedResponse:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: "Success operation" }
 *         data:
 *           $ref: '#/components/schemas/FlowPolicy'
 */

