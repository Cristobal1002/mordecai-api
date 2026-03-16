/**
 * @swagger
 * tags:
 *   name: Catalog
 *   description: >
 *     **Capa 1 — Catálogo.** Metadata global de softwares (PMS) y pasos del wizard.
 *     No depende de tenants. El front consulta aquí para mostrar cards y guía de conexión.
 */

/**
 * @swagger
 * /catalog/softwares:
 *   post:
 *     summary: Crear software
 *     description: Alta de un software en el catálogo (backoffice; sin auth por ahora). El key se normaliza a minúsculas y debe ser único.
 *     tags: [Catalog]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateSoftwareRequest'
 *     responses:
 *       201:
 *         description: Software creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CatalogSoftwareCreatedResponse'
 *       400:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Ya existe un software con ese key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 *   get:
 *     summary: Listar softwares disponibles
 *     description: Lista de softwares habilitados (Buildium, Rentvine, etc.) con logo, nombre, tipo de auth y capacidades.
 *     tags: [Catalog]
 *     parameters:
 *       - in: query
 *         name: category
 *         required: false
 *         schema:
 *           type: string
 *           example: property_manager
 *     responses:
 *       200:
 *         description: Lista de softwares
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CatalogSoftwaresListResponse'
 *       400:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /catalog/softwares/{softwareKey}/setup-steps:
 *   get:
 *     summary: Obtener pasos del wizard por software
 *     description: Pasos ordenados para el wizard de configuración (info, copy, link, etc.).
 *     tags: [Catalog]
 *     parameters:
 *       - in: path
 *         name: softwareKey
 *         required: true
 *         schema:
 *           type: string
 *           example: buildium
 *     responses:
 *       200:
 *         description: Lista de setup steps
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CatalogSetupStepsListResponse'
 *       400:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Software no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorNotFoundResponse'
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Software:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         key: { type: string, example: "buildium" }
 *         name: { type: string, example: "Buildium" }
 *         category: { type: string, example: "property_manager" }
 *         authType: { type: string, example: "oauth2", enum: [oauth2, apiKey] }
 *         authConfig: { type: object, additionalProperties: true }
 *         capabilities: { type: object, additionalProperties: true }
 *         logoUrl: { type: string, nullable: true }
 *         docsUrl: { type: string, nullable: true }
 *         isEnabled: { type: boolean, example: true }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *
 *     CreateSoftwareRequest:
 *       type: object
 *       required: [key, name, category, authType]
 *       properties:
 *         key: { type: string, example: "buildium", description: "Identificador único; se normaliza a minúsculas. Solo a-z, 0-9, _ y -" }
 *         name: { type: string, example: "Buildium", maxLength: 120 }
 *         category: { type: string, example: "property_manager", maxLength: 64 }
 *         authType: { type: string, enum: [oauth2, apiKey] }
 *         authConfig: { type: object, additionalProperties: true, default: {} }
 *         capabilities: { type: object, additionalProperties: true, default: {} }
 *         logoUrl: { type: string, format: uri, nullable: true }
 *         docsUrl: { type: string, format: uri, nullable: true }
 *         isEnabled: { type: boolean, default: true }
 *
 *     CatalogSoftwareCreatedResponse:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: "Software created successfully" }
 *         data:
 *           $ref: '#/components/schemas/Software'
 *
 *     SoftwareSetupStep:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         softwareId: { type: string, format: uuid }
 *         order: { type: integer, example: 1 }
 *         title: { type: string }
 *         body: { type: string, nullable: true }
 *         type: { type: string, example: "info", enum: [info, copy, link, warning, check] }
 *         copyValue: { type: string, nullable: true }
 *         linkUrl: { type: string, nullable: true }
 *         mediaUrl: { type: string, nullable: true }
 *         meta: { type: object, nullable: true }
 *
 *     CatalogSoftwaresListResponse:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: "Softwares retrieved successfully" }
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Software'
 *
 *     CatalogSetupStepsListResponse:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: "Setup steps retrieved successfully" }
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/SoftwareSetupStep'
 */
