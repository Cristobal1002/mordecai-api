/**
 * Routes - Definición de rutas del módulo
 * 
 * Este archivo define todas las rutas del módulo y las conecta
 * con los controllers, validators y middlewares necesarios.
 */
import { Router } from 'express';
import { exampleController } from './example.controller.js';
import {
  createExampleValidator,
  updateExampleValidator,
  listExampleValidator,
} from './example.validator.js';
import { validateRequest } from '../../middlewares/validate-request.middleware.js';

// Importar el archivo swagger para que se registre la documentación
import './example.swagger.js';

const router = Router();

// POST /api/v1/examples - Crear un nuevo ejemplo
router.post(
  '/',
  createExampleValidator,
  validateRequest,
  exampleController.create
);

// GET /api/v1/examples - Listar ejemplos (con paginación y filtros)
router.get(
  '/',
  listExampleValidator,
  validateRequest,
  exampleController.list
);

// GET /api/v1/examples/:id - Obtener un ejemplo por ID
router.get('/:id', exampleController.getById);

// PUT /api/v1/examples/:id - Actualizar un ejemplo
router.put(
  '/:id',
  updateExampleValidator,
  validateRequest,
  exampleController.update
);

// DELETE /api/v1/examples/:id - Eliminar un ejemplo (soft delete)
router.delete('/:id', exampleController.softDelete);

export default router;

