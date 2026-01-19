/**
 * Swagger - Documentación de la API
 * 
 * Este archivo contiene la documentación Swagger/OpenAPI del módulo.
 * Se usa para generar la documentación interactiva en /api/v1/docs
 */

/**
 * @swagger
 * tags:
 *   name: Examples
 *   description: >
 *     El módulo **Examples** es un módulo de ejemplo que demuestra cómo implementar
 *     un CRUD completo siguiendo la arquitectura modular del proyecto.
 *     <br/>Este módulo incluye:
 *     <ul>
 *       <li>Crear nuevos registros</li>
 *       <li>Listar registros con paginación y filtros</li>
 *       <li>Consultar un registro específico por ID</li>
 *       <li>Actualizar registros existentes</li>
 *       <li>Eliminación lógica (soft delete)</li>
 *     </ul>
 */

/**
 * @swagger
 * /examples:
 *   post:
 *     summary: Crear un nuevo ejemplo
 *     description: Crea un nuevo registro de ejemplo.
 *     tags: [Examples]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 100
 *                 example: "Ejemplo de prueba"
 *               description:
 *                 type: string
 *                 example: "Esta es una descripción de ejemplo"
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *                 example: "active"
 *     responses:
 *       201:
 *         description: Ejemplo creado exitosamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 201
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Example created successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Example'
 *                 error:
 *                   type: object
 *       400:
 *         description: Error de validación en los datos de entrada.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Error interno del servidor.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /examples:
 *   get:
 *     summary: Listar ejemplos
 *     description: Retorna una lista paginada de ejemplos con opciones de filtrado.
 *     tags: [Examples]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *           example: 1
 *         description: Número de página
 *       - in: query
 *         name: perPage
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *           example: 10
 *         description: Registros por página
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Filtrar por nombre (búsqueda parcial)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *         description: Filtrar por estado
 *     responses:
 *       200:
 *         description: Lista de ejemplos obtenida correctamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 200
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   example: "Examples retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     items:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Example'
 *                     meta:
 *                       $ref: '#/components/schemas/PaginationMeta'
 *                 error:
 *                   type: object
 *       500:
 *         description: Error interno del servidor.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /examples/{id}:
 *   get:
 *     summary: Obtener un ejemplo por ID
 *     description: Retorna los detalles de un ejemplo específico.
 *     tags: [Examples]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del ejemplo
 *     responses:
 *       200:
 *         description: Ejemplo obtenido correctamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Example'
 *                 error:
 *                   type: object
 *       404:
 *         description: Ejemplo no encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorNotFoundResponse'
 *       500:
 *         description: Error interno del servidor.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /examples/{id}:
 *   put:
 *     summary: Actualizar un ejemplo
 *     description: Actualiza los datos de un ejemplo existente.
 *     tags: [Examples]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del ejemplo
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 100
 *               description:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *     responses:
 *       200:
 *         description: Ejemplo actualizado correctamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   example: "Example updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Example'
 *                 error:
 *                   type: object
 *       400:
 *         description: Error de validación.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Ejemplo no encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorNotFoundResponse'
 *       500:
 *         description: Error interno del servidor.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /examples/{id}:
 *   delete:
 *     summary: Eliminar un ejemplo
 *     description: Realiza una eliminación lógica (soft delete) del ejemplo.
 *     tags: [Examples]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del ejemplo
 *     responses:
 *       200:
 *         description: Ejemplo eliminado correctamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   example: "Example deleted successfully"
 *                 data:
 *                   type: object
 *                 error:
 *                   type: object
 *       404:
 *         description: Ejemplo no encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorNotFoundResponse'
 *       500:
 *         description: Error interno del servidor.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Example:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         name:
 *           type: string
 *           example: "Ejemplo de prueba"
 *         description:
 *           type: string
 *           nullable: true
 *           example: "Esta es una descripción de ejemplo"
 *         status:
 *           type: string
 *           enum: [active, inactive]
 *           example: "active"
 *         isDelete:
 *           type: boolean
 *           example: false
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

