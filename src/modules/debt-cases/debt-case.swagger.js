/**
 * @swagger
 * tags:
 *   name: DebtCases
 *   description: >
 *     El módulo **DebtCases** permite consultar casos de deuda y su historial de interacciones (logs) por tenant.
 */

/**
 * @swagger
 * /debt-cases/{tenantId}:
 *   get:
 *     summary: Listar casos por tenant
 *     description: Retorna casos asociados al tenant.
 *     tags: [DebtCases]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Lista de casos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DebtCaseListResponse'
 *       400:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /debt-cases/{tenantId}/{caseId}/logs:
 *   get:
 *     summary: Obtener logs de un caso
 *     description: Retorna el historial de interacción (logs) de un caso.
 *     tags: [DebtCases]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: caseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Logs del caso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DebtCaseLogsResponse'
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
 *     DebtCase:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         tenantId: { type: string, format: uuid }
 *         debtorId: { type: string, format: uuid }
 *         status: { type: string, example: "NEW" }
 *         nextActionAt: { type: string, format: date-time, nullable: true }
 *         lastContactedAt: { type: string, format: date-time, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *
 *     InteractionLog:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         tenantId: { type: string, format: uuid }
 *         debtCaseId: { type: string, format: uuid }
 *         debtorId: { type: string, format: uuid }
 *         type: { type: string, example: "CALL" }
 *         status: { type: string, example: "completed" }
 *         outcome: { type: string, nullable: true, example: "NO_ANSWER" }
 *         startedAt: { type: string, format: date-time, nullable: true }
 *         endedAt: { type: string, format: date-time, nullable: true }
 *
 *     DebtCaseListResponse:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: "Success operation" }
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/DebtCase'
 *
 *     DebtCaseLogsResponse:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: "Success operation" }
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/InteractionLog'

