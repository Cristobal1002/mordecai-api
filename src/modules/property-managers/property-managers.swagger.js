/**
 * @swagger
 * tags:
 *   name: PropertyManagers
 *   description: >
 *     **Capa 2 — Property Managers.** Conexiones por tenant a un software (PMS).
 *     Estados draft | connected | syncing | error | disabled. testConnection y triggerSync.
 *     El sync real se ejecuta en mordecai-workers (BullMQ/Upstash).
 */

/**
 * @swagger
 * /tenants/{tenantId}/pms-connections:
 *   get:
 *     summary: Listar conexiones PMS del tenant
 *     tags: [PropertyManagers]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Lista de conexiones
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/PmsConnectionsListResponse' }
 *       400: { description: 'Error de validación', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: 'No autorizado', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorUnauthorizedResponse' } } } }
 *
 *   post:
 *     summary: Crear conexión PMS
 *     tags: [PropertyManagers]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreatePmsConnectionRequest' }
 *     responses:
 *       201:
 *         description: Conexión creada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/PmsConnectionResponse' }
 *       400: { description: 'Error de validación', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: 'No autorizado', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorUnauthorizedResponse' } } } }
 *       409: { description: 'Ya existe una conexión para este software', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */

/**
 * @swagger
 * /tenants/{tenantId}/pms-connections/{connectionId}:
 *   get:
 *     summary: Obtener una conexión PMS por ID
 *     tags: [PropertyManagers]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: connectionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Conexión
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/PmsConnectionResponse' }
 *       401: { description: 'No autorizado', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorUnauthorizedResponse' } } } }
 *       404: { description: 'Conexión no encontrada', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorNotFoundResponse' } } } }
 */

/**
 * @swagger
 * /tenants/{tenantId}/pms-connections/{connectionId}/credentials:
 *   patch:
 *     summary: Actualizar credenciales de la conexión
 *     tags: [PropertyManagers]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: connectionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UpdateCredentialsRequest' }
 *     responses:
 *       200:
 *         description: Credenciales actualizadas
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/PmsConnectionResponse' }
 *       401: { description: 'No autorizado', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorUnauthorizedResponse' } } } }
 *       404: { description: 'Conexión no encontrada', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorNotFoundResponse' } } } }
 */

/**
 * @swagger
 * /tenants/{tenantId}/pms-connections/{connectionId}/status:
 *   patch:
 *     summary: Actualizar estado de la conexión
 *     tags: [PropertyManagers]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: connectionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UpdateStatusRequest' }
 *     responses:
 *       200:
 *         description: Estado actualizado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/PmsConnectionResponse' }
 *       400: { description: 'status inválido', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: 'No autorizado', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorUnauthorizedResponse' } } } }
 *       404: { description: 'Conexión no encontrada', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorNotFoundResponse' } } } }
 */

/**
 * @swagger
 * /tenants/{tenantId}/pms-connections/{connectionId}/test:
 *   post:
 *     summary: Probar conexión (testConnection del connector)
 *     tags: [PropertyManagers]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: connectionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Resultado del test (ok + message)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TestConnectionResponse' }
 *       400: { description: 'Connector no disponible', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: 'No autorizado', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorUnauthorizedResponse' } } } }
 *       404: { description: 'Conexión no encontrada', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorNotFoundResponse' } } } }
 */

/**
 * @swagger
 * /tenants/{tenantId}/pms-connections/{connectionId}/sync:
 *   post:
 *     summary: Solicitar sincronización
 *     description: Pone la conexión en estado syncing. El worker en mordecai-workers (BullMQ/Upstash) procesa el sync.
 *     tags: [PropertyManagers]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: connectionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Sync solicitado (enqueued, status syncing)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TriggerSyncResponse' }
 *       400: { description: 'Conexión no en connected/error o connector no disponible', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: 'No autorizado', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorUnauthorizedResponse' } } } }
 *       404: { description: 'Conexión no encontrada', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorNotFoundResponse' } } } }
 *       409: { description: 'Ya hay un sync en progreso', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     PmsConnection:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         tenantId: { type: string, format: uuid }
 *         softwareId: { type: string, format: uuid }
 *         status: { type: string, enum: [draft, connected, syncing, error, disabled] }
 *         credentials: { type: object, nullable: true }
 *         externalAccountId: { type: string, nullable: true }
 *         capabilities: { type: object, nullable: true }
 *         lastSyncedAt: { type: string, format: date-time, nullable: true }
 *         lastError: { type: object, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *         software:
 *           $ref: '#/components/schemas/Software'
 *
 *     CreatePmsConnectionRequest:
 *       type: object
 *       required: [softwareKey]
 *       properties:
 *         softwareKey: { type: string, example: "buildium" }
 *         credentials: { type: object, nullable: true }
 *         status: { type: string, enum: [draft, connected, syncing, error, disabled], example: "draft" }
 *
 *     UpdateCredentialsRequest:
 *       type: object
 *       properties:
 *         credentials: { type: object }
 *
 *     UpdateStatusRequest:
 *       type: object
 *       required: [status]
 *       properties:
 *         status: { type: string, enum: [draft, connected, syncing, error, disabled] }
 *
 *     PmsConnectionsListResponse:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string }
 *         data:
 *           type: array
 *           items: { $ref: '#/components/schemas/PmsConnection' }
 *
 *     PmsConnectionResponse:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string }
 *         data: { $ref: '#/components/schemas/PmsConnection' }
 *
 *     TestConnectionResponse:
 *       type: object
 *       properties:
 *         success: { type: boolean }
 *         message: { type: string }
 *         data:
 *           type: object
 *           properties:
 *             ok: { type: boolean }
 *             message: { type: string, nullable: true }
 *
 *     TriggerSyncResponse:
 *       type: object
 *       properties:
 *         success: { type: boolean }
 *         message: { type: string }
 *         data:
 *           type: object
 *           properties:
 *             enqueued: { type: boolean }
 *             connectionId: { type: string, format: uuid }
 *             status: { type: string, example: "syncing" }
 *             message: { type: string }
 */
