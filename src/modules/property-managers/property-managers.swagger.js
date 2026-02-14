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
 *     summary: Edit connection (update credentials)
 *     description: Updates the stored credentials for an existing PMS connection. Use this to change API keys, secrets, or account/subdomain. Clears lastError on success.
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
 *     summary: Update connection status
 *     description: Change the connection status (draft, connected, syncing, error, disabled). Use status `disabled` to deactivate a connection without deleting it; it will no longer appear as connected in the UI.
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
 * /tenants/{tenantId}/pms-connections/{connectionId}:
 *   delete:
 *     summary: Delete connection (remove connection)
 *     description: Permanently deletes the PMS connection. Credentials and connection metadata are removed. The tenant can create a new connection to the same software later.
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
 *         description: Connection deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Connection deleted successfully" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     deleted: { type: boolean, example: true }
 *                     connectionId: { type: string, format: uuid }
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
 * /tenants/{tenantId}/pms-connections/test-credentials:
 *   post:
 *     summary: Test credentials without creating a connection
 *     description: Calls the connector's test (e.g. Rentvine GET /portfolios/search). Returns ok + message. Use before creating a connection to validate credentials.
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
 *           schema:
 *             type: object
 *             required: [softwareKey, credentials]
 *             properties:
 *               softwareKey: { type: string, example: "rentvine" }
 *               credentials: { type: object, description: "Keys depend on software (e.g. accessKey, secret, account for Rentvine)" }
 *     responses:
 *       200:
 *         description: Test result (ok true/false, message if failed)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TestConnectionResponse' }
 *       400: { description: 'softwareKey required, credentials required, or connector not available', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: 'No autorizado', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorUnauthorizedResponse' } } } }
 *       404: { description: 'Tenant or software not found', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorNotFoundResponse' } } } }
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
