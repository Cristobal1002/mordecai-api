/**
 * @swagger
 * tags:
 *   name: Work
 *   description: >
 *     El módulo **Work** permite ejecutar trabajos manuales para un tenant (por ejemplo, disparar scheduling o procesamiento).
 */

/**
 * @swagger
 * /work/{tenantId}/run:
 *   post:
 *     summary: Ejecutar trabajo para un tenant
 *     description: Ejecuta un run de trabajo para un tenant con opciones como `limit` y `dryRun`.
 *     tags: [Work]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WorkRunRequest'
 *           examples:
 *             default:
 *               value:
 *                 limit: 500
 *                 dryRun: false
 *     responses:
 *       200:
 *         description: Trabajo ejecutado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WorkRunResponse'
 *       400:
 *         description: Error de validación
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
 *     WorkRunRequest:
 *       type: object
 *       properties:
 *         limit:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *           example: 500
 *         dryRun:
 *           type: boolean
 *           example: false
 *
 *     WorkRunResult:
 *       type: object
 *       properties:
 *         found: { type: integer, example: 10 }
 *         queued: { type: integer, example: 8 }
 *         dryRun: { type: boolean, example: false }
 *
 *     WorkRunResponse:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: "Success operation" }
 *         data:
 *           $ref: '#/components/schemas/WorkRunResult'

