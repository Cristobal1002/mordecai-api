/**
 * @swagger
 * tags:
 *   name: Debtors
 *   description: >
 *     El módulo **Debtors** permite consultar deudores asociados a un tenant.
 */

/**
 * @swagger
 * /debtors/{tenantId}:
 *   get:
 *     summary: Listar deudores por tenant
 *     description: Retorna la lista de deudores asociados al tenant.
 *     tags: [Debtors]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Lista de deudores
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DebtorListResponse'
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
 *     Debtor:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         tenantId: { type: string, format: uuid }
 *         name: { type: string, example: "John Doe" }
 *         email: { type: string, format: email, nullable: true, example: "john@doe.com" }
 *         phone: { type: string, nullable: true, example: "+57 300 000 0000" }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *
 *     DebtorListResponse:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: "Success operation" }
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Debtor'

