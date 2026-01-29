/**
 * @swagger
 * tags:
 *   name: Imports
 *   description: >
 *     El módulo **Imports** permite cargar archivos (por ejemplo `.xlsx`) para un tenant,
 *     consultar el estado del batch y disparar el procesamiento.
 *     <br/>Incluye:
 *     <ul>
 *       <li>Crear batch con upload (multipart/form-data)</li>
 *       <li>Consultar estado del batch</li>
 *       <li>Iniciar procesamiento del batch</li>
 *     </ul>
 */

/**
 * @swagger
 * /import-batches/{tenantId}:
 *   post:
 *     summary: Crear import batch (upload .xlsx)
 *     description: Crea un batch de importación subiendo un archivo `.xlsx`.
 *     tags: [Imports]
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
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/ImportBatchUploadRequest'
 *     responses:
 *       201:
 *         description: Batch creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ImportBatchCreatedResponse'
 *       400:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /import-batches/{tenantId}/{batchId}:
 *   get:
 *     summary: Obtener estado de un batch
 *     description: Retorna el estado actual del batch.
 *     tags: [Imports]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: batchId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Estado del batch
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ImportBatchStatusResponse'
 *       400:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /import-batches/{tenantId}/{batchId}/process:
 *   post:
 *     summary: Procesar un batch
 *     description: Inicia el procesamiento del batch (puede ser asíncrono).
 *     tags: [Imports]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: batchId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Proceso iniciado
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
 * components:
 *   schemas:
 *     SuccessResponse:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: "Success operation" }
 *         data: { type: object, nullable: true }
 *
 *     ImportBatchUploadRequest:
 *       type: object
 *       required:
 *         - file
 *       properties:
 *         file:
 *           type: string
 *           format: binary
 *
 *     ImportBatch:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         tenantId: { type: string, format: uuid }
 *         status: { type: string, example: "created" }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *
 *     ImportBatchCreatedResponse:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: "Batch created" }
 *         data:
 *           $ref: '#/components/schemas/ImportBatch'
 *
 *     ImportBatchStatusResponse:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: "Success operation" }
 *         data:
 *           $ref: '#/components/schemas/ImportBatch'

